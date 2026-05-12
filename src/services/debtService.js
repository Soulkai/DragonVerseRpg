const db = require('../database/db');
const { money, formatDateTime } = require('../utils/format');
const { recordLedger } = require('./ledgerService');
const { getPlayerByWhatsAppId } = require('./playerService');

const LOAN_DAILY_RATE = 0.50;
const DAY_MS = 24 * 60 * 60 * 1000;

function getPlayerById(playerId) {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
}

function getOpenLoan(playerId) {
  return db.prepare(`
    SELECT * FROM player_loans
    WHERE player_id = ? AND status IN ('pending', 'active')
    ORDER BY id DESC
    LIMIT 1
  `).get(playerId);
}

function createOrRefreshPendingLoan(playerId, amountNeeded) {
  const amount = Math.floor(Number(amountNeeded || 0));
  if (amount <= 0) return null;

  const existing = getOpenLoan(playerId);
  if (existing) {
    if (existing.status === 'pending' && Number(existing.principal || 0) < amount) {
      db.prepare(`
        UPDATE player_loans
        SET principal = ?,
            current_debt = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amount, amount, existing.id);
      return db.prepare('SELECT * FROM player_loans WHERE id = ?').get(existing.id);
    }
    return existing;
  }

  const result = db.prepare(`
    INSERT INTO player_loans (player_id, principal, current_debt, status, last_accrual_at)
    VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `).run(playerId, amount, amount);

  return db.prepare('SELECT * FROM player_loans WHERE id = ?').get(result.lastInsertRowid);
}

function loanPrompt(player, amountNeeded = null) {
  const amount = Math.floor(Number(amountNeeded || Math.abs(Number(player?.zenies || 0)) || 0));
  if (amount <= 0) return '';

  return [
    '',
    '⚠️ *Saldo negativo detectado.*',
    `💸 Dívida atual: *${money(amount)} Zenies*`,
    '',
    'Gostaria de pegar um empréstimo?',
    'Use */emprestimo aceitar* para cobrir o saldo negativo.',
    'Use */emprestimo recusar* para recusar.',
    '',
    '⚠️ Caso aceite e não pague, a dívida aumenta todos os dias em *50% do valor inicial*.',
  ].join('\n');
}

function chargePlayerWithDebt(playerId, amount, options = {}) {
  const value = Math.floor(Number(amount || 0));
  if (!playerId || value <= 0) {
    return {
      ok: false,
      message: 'Valor inválido.',
      charged: 0,
      usedZenies: 0,
      usedDeposit: 0,
      negativeAdded: 0,
      updated: getPlayerById(playerId),
      loan: null,
      prompt: '',
    };
  }

  const player = getPlayerById(playerId);
  if (!player) {
    return { ok: false, message: 'Jogador não encontrado.' };
  }

  const allowNegative = options.allowNegative !== false;
  const drainDeposit = options.drainDeposit !== false;
  const category = options.category || 'perda';
  const description = options.description || 'Perda de Zenies';
  const direction = options.direction || 'perda';

  const currentZenies = Number(player.zenies || 0);
  const currentDeposit = Number(player.deposito || 0);
  let remaining = value;
  let usedZenies = 0;
  let usedDeposit = 0;
  let negativeAdded = 0;

  const availableZenies = Math.max(0, currentZenies);
  usedZenies = Math.min(availableZenies, remaining);
  remaining -= usedZenies;

  if (drainDeposit && remaining > 0) {
    usedDeposit = Math.min(currentDeposit, remaining);
    remaining -= usedDeposit;
  }

  if (remaining > 0 && allowNegative) {
    negativeAdded = remaining;
    remaining = 0;
  }

  if (remaining > 0 && !allowNegative) {
    return {
      ok: false,
      message: `Saldo insuficiente. Você tem *${money(currentZenies)} Zenies* e *${money(currentDeposit)} Zenies* na poupança.`,
      charged: 0,
      usedZenies: 0,
      usedDeposit: 0,
      negativeAdded: 0,
      updated: player,
      loan: null,
      prompt: '',
    };
  }

  const newZenies = currentZenies - usedZenies - negativeAdded;
  const newDeposit = currentDeposit - usedDeposit;

  db.prepare(`
    UPDATE players
    SET zenies = ?,
        deposito = ?,
        last_deposit_at = CASE WHEN ? <= 0 THEN NULL ELSE last_deposit_at END,
        last_deposit_interest_at = CASE WHEN ? <= 0 THEN NULL ELSE last_deposit_interest_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newZenies, newDeposit, newDeposit, newDeposit, playerId);

  recordLedger({
    playerId,
    direction,
    category,
    amount: value,
    description,
    balanceAfter: newZenies,
    metadata: {
      usedZenies,
      usedDeposit,
      negativeAdded,
      allowNegative,
    },
  });

  const updated = getPlayerById(playerId);
  let loan = null;
  let prompt = '';
  if (Number(updated.zenies || 0) < 0) {
    const negativeAmount = Math.abs(Number(updated.zenies || 0));
    loan = createOrRefreshPendingLoan(playerId, negativeAmount);
    prompt = loanPrompt(updated, negativeAmount);
  }

  return {
    ok: true,
    charged: value,
    usedZenies,
    usedDeposit,
    negativeAdded,
    updated,
    loan,
    prompt,
  };
}

function accrueLoanInterest() {
  const loans = db.prepare(`
    SELECT * FROM player_loans
    WHERE status = 'active'
      AND current_debt > 0
      AND last_accrual_at IS NOT NULL
  `).all();

  const now = Date.now();
  let updatedCount = 0;
  let totalAdded = 0;

  const update = db.prepare(`
    UPDATE player_loans
    SET current_debt = current_debt + ?,
        last_accrual_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  for (const loan of loans) {
    const last = new Date(loan.last_accrual_at).getTime();
    if (!Number.isFinite(last)) continue;
    const periods = Math.floor((now - last) / DAY_MS);
    if (periods <= 0) continue;

    const added = Math.floor(Number(loan.principal || 0) * LOAN_DAILY_RATE * periods);
    const nextDate = new Date(last + periods * DAY_MS).toISOString();
    update.run(added, nextDate, loan.id);
    updatedCount += 1;
    totalAdded += added;
  }

  return { updatedCount, totalAdded };
}

function loanStatusMessage(player) {
  const loan = getOpenLoan(player.id);
  if (!loan) {
    return [
      '🏦 *Empréstimo DragonVerse*',
      '',
      'Você não possui empréstimo pendente ou ativo.',
      Number(player.zenies || 0) < 0 ? loanPrompt(player) : null,
    ].filter(Boolean).join('\n');
  }

  return [
    '🏦 *Empréstimo DragonVerse*',
    '',
    `Status: *${loan.status === 'pending' ? 'Pendente' : 'Ativo'}*`,
    `💵 Valor inicial: *${money(loan.principal)} Zenies*`,
    `💸 Dívida atual: *${money(loan.current_debt)} Zenies*`,
    loan.accepted_at ? `📅 Aceito em: *${formatDateTime(loan.accepted_at)}*` : null,
    loan.last_accrual_at ? `⏳ Último cálculo de juros: *${formatDateTime(loan.last_accrual_at)}*` : null,
    '',
    loan.status === 'pending' ? 'Use */emprestimo aceitar* ou */emprestimo recusar*.' : 'Use */emprestimo pagar valor* para pagar a dívida.',
  ].filter(Boolean).join('\n');
}

function loanCommand(message, argsText = '') {
  const player = require('./playerService').getOrCreatePlayerFromMessage(message, { touch: true });
  const action = String(argsText || '').trim().split(/\s+/)[0]?.toLowerCase() || 'status';

  if (['status', 'ver', ''].includes(action)) {
    return { ok: true, message: loanStatusMessage(player) };
  }

  if (['aceitar', 'sim', 'pegar'].includes(action)) {
    const freshBefore = getPlayerById(player.id);
    const negative = Math.max(0, Math.abs(Math.min(0, Number(freshBefore.zenies || 0))));
    let loan = getOpenLoan(player.id);
    if (!loan && negative > 0) loan = createOrRefreshPendingLoan(player.id, negative);

    if (!loan || loan.status !== 'pending') {
      return { ok: false, message: 'Você não possui empréstimo pendente para aceitar.' };
    }

    if (negative <= 0) {
      db.prepare(`UPDATE player_loans SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(loan.id);
      return { ok: false, message: 'Seu saldo não está mais negativo. O empréstimo pendente foi cancelado.' };
    }

    const principal = negative;
    db.prepare(`
      UPDATE players
      SET zenies = zenies + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(principal, player.id);

    db.prepare(`
      UPDATE player_loans
      SET principal = ?,
          current_debt = ?,
          status = 'active',
          accepted_at = CURRENT_TIMESTAMP,
          last_accrual_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(principal, principal, loan.id);

    recordLedger({
      playerId: player.id,
      direction: 'entrada',
      category: 'emprestimo',
      amount: principal,
      description: 'Empréstimo aceito',
    });

    const updated = getPlayerByWhatsAppId(player.whatsapp_id) || getPlayerById(player.id);
    return {
      ok: true,
      message: [
        '✅ *Empréstimo aceito!*',
        '',
        `💵 Valor recebido: *${money(principal)} Zenies*`,
        `💸 Dívida inicial: *${money(principal)} Zenies*`,
        `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
        '',
        'A dívida aumenta todos os dias em *50% do valor inicial* enquanto não for paga.',
      ].join('\n'),
    };
  }

  if (['recusar', 'nao', 'não'].includes(action)) {
    const loan = getOpenLoan(player.id);
    if (!loan || loan.status !== 'pending') {
      return { ok: false, message: 'Você não possui empréstimo pendente para recusar.' };
    }

    db.prepare(`
      UPDATE player_loans
      SET status = 'refused',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(loan.id);

    return {
      ok: true,
      message: [
        '❌ *Empréstimo recusado.*',
        '',
        `💰 Seu saldo permanece em: *${money(player.zenies)} Zenies*`,
      ].join('\n'),
    };
  }

  if (['pagar', 'pagamento', 'quitar'].includes(action)) {
    const amountText = String(argsText || '').trim().split(/\s+/)[1];
    const { parseAmount } = require('../utils/numbers');
    const amount = parseAmount(amountText);
    const loan = getOpenLoan(player.id);

    if (!loan || loan.status !== 'active') {
      return { ok: false, message: 'Você não possui empréstimo ativo para pagar.' };
    }

    if (!amount || amount <= 0) {
      return { ok: false, message: 'Use assim: */emprestimo pagar valor*' };
    }

    const fresh = getPlayerById(player.id);
    if (Number(fresh.zenies || 0) < amount) {
      return { ok: false, message: `Saldo insuficiente. Você tem *${money(fresh.zenies)} Zenies*.` };
    }

    const paid = Math.min(amount, Number(loan.current_debt || 0));
    const remaining = Math.max(0, Number(loan.current_debt || 0) - paid);

    db.prepare(`
      UPDATE players
      SET zenies = zenies - ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(paid, player.id);

    db.prepare(`
      UPDATE player_loans
      SET current_debt = ?,
          status = CASE WHEN ? <= 0 THEN 'paid' ELSE status END,
          paid_at = CASE WHEN ? <= 0 THEN CURRENT_TIMESTAMP ELSE paid_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(remaining, remaining, remaining, loan.id);

    recordLedger({
      playerId: player.id,
      direction: 'saida',
      category: 'emprestimo_pagamento',
      amount: paid,
      description: 'Pagamento de empréstimo',
    });

    const updated = getPlayerById(player.id);
    return {
      ok: true,
      message: [
        '✅ *Pagamento realizado!*',
        '',
        `💸 Pago: *${money(paid)} Zenies*`,
        `🏦 Dívida restante: *${money(remaining)} Zenies*`,
        `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
      ].join('\n'),
    };
  }

  return {
    ok: false,
    message: 'Use: */emprestimo status*, */emprestimo aceitar*, */emprestimo recusar* ou */emprestimo pagar valor*.',
  };
}

module.exports = {
  LOAN_DAILY_RATE,
  getOpenLoan,
  createOrRefreshPendingLoan,
  loanPrompt,
  chargePlayerWithDebt,
  accrueLoanInterest,
  loanCommand,
};
