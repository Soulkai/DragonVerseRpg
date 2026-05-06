const db = require('../database/db');
const { isAdmin } = require('../utils/admin');
const { getFirstMentionedId, removeFirstMention } = require('../utils/mentions');
const { parseAmount, parseInteger } = require('../utils/numbers');
const { money, formatKiLevel, formatDateTime, getNextDepositInterestAt, balanceCaption } = require('../utils/format');
const { grantZenies } = require('./rewardService');
const { recordLedger } = require('./ledgerService');
const {
  DAY_MS,
  SALARY_INTERVAL_DAYS,
  DEPOSIT_INTEREST_INTERVAL_DAYS,
  DEPOSIT_INTEREST_RATE,
} = require('../data/roles');
const {
  getOrCreatePlayerFromMessage,
  getOrCreatePlayerByWhatsAppId,
  getPlayerByWhatsAppId,
} = require('./playerService');

async function requireAdmin(message) {
  if (await isAdmin(message)) return { ok: true };

  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  if (['A.S', 'S.M'].includes(player.cargo_id)) return { ok: true };

  return { ok: false, message: 'Apenas administradores, Autoridade Suprema ou Supremo Ministro podem usar esse comando.' };
}


function mentionTagFromId(whatsappId = '') {
  const id = String(whatsappId || '').trim();
  if (!id) return '';
  return id.split('@')[0].replace(/[^0-9a-zA-Z]/g, '');
}

function mentionPlayer(player) {
  const tag = mentionTagFromId(player?.whatsapp_id) || String(player?.phone || '').replace(/\D/g, '');
  return tag ? `@${tag}` : '@jogador';
}

function mentionIds(...players) {
  return [...new Set(players.map((player) => player?.whatsapp_id).filter(Boolean))];
}

async function addZenies(message, argsText) {
  const permission = await requireAdmin(message);
  if (!permission.ok) return permission;

  const targetWhatsappId = getFirstMentionedId(message, argsText);
  if (!targetWhatsappId) {
    return { ok: false, message: 'Use assim: */addzenies @pessoa valor*' };
  }

  const rest = removeFirstMention(argsText);
  const amount = parseAmount(rest.split(/\s+/)[0]);
  if (!amount || amount <= 0) {
    return { ok: false, message: 'Informe um valor válido. Exemplo: */addzenies @pessoa 50000000*' };
  }

  const target = getOrCreatePlayerByWhatsAppId(targetWhatsappId, null, { touch: false });
  db.prepare(`
    UPDATE players
    SET zenies = zenies + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, target.id);

  const updated = getPlayerByWhatsAppId(targetWhatsappId);
  recordLedger({
    playerId: updated.id,
    direction: 'entrada',
    category: 'addzenies',
    amount,
    description: 'Zenies adicionados por ADM',
  });

  return {
    ok: true,
    message: [
      '✅ *Zenies adicionados!*',
      '',
      `👤 Jogador: ${mentionPlayer(updated)}`,
      `➕ Valor: *${money(amount)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].join('\n'),
    mentions: mentionIds(updated),
  };
}

async function retirarZenies(message, argsText) {
  const permission = await requireAdmin(message);
  if (!permission.ok) return permission;

  const targetWhatsappId = getFirstMentionedId(message, argsText);
  if (!targetWhatsappId) {
    return { ok: false, message: 'Use assim: */retirarzenies @pessoa valor*' };
  }

  const rest = removeFirstMention(argsText);
  const amount = parseAmount(rest.split(/\s+/)[0]);
  if (!amount || amount <= 0) {
    return { ok: false, message: 'Informe um valor válido. Exemplo: */retirarzenies @pessoa 50000000*' };
  }

  const target = getOrCreatePlayerByWhatsAppId(targetWhatsappId, null, { touch: false });
  const discount = Math.min(Number(target.zenies || 0), amount);

  db.prepare(`
    UPDATE players
    SET zenies = MAX(zenies - ?, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, target.id);

  const updated = getPlayerByWhatsAppId(targetWhatsappId);
  if (discount > 0) {
    recordLedger({
      playerId: updated.id,
      direction: 'perda',
      category: 'retirarzenies',
      amount: discount,
      description: 'Zenies retirados por ADM',
    });
  }

  return {
    ok: true,
    message: [
      '✅ *Zenies retirados!*',
      '',
      `👤 Jogador: ${mentionPlayer(updated)}`,
      `➖ Valor solicitado: *${money(amount)} Zenies*`,
      `💸 Valor retirado: *${money(discount)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].join('\n'),
    mentions: mentionIds(updated),
  };
}

async function definirKi(message, argsText) {
  const permission = await requireAdmin(message);
  if (!permission.ok) return permission;

  const targetWhatsappId = getFirstMentionedId(message, argsText);
  if (!targetWhatsappId) {
    return { ok: false, message: 'Use assim: */definirki @pessoa valor*' };
  }

  const rest = removeFirstMention(argsText);
  const ki = parseInteger(rest.split(/\s+/)[0]);
  if (!ki || ki <= 0) {
    return { ok: false, message: 'Informe um Ki válido. Exemplo: */definirki @pessoa 5*' };
  }

  const target = getOrCreatePlayerByWhatsAppId(targetWhatsappId, null, { touch: false });
  db.prepare(`
    UPDATE players
    SET ki_atual = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(ki, target.id);

  const updated = getPlayerByWhatsAppId(targetWhatsappId);

  return {
    ok: true,
    message: [
      '✅ *Ki definido!*',
      '',
      `👤 Jogador: ${mentionPlayer(updated)}`,
      `🔥 Ki atual: *Ki ${formatKiLevel(updated.ki_atual)}*`,
      `💪 Atributos totais: *${money(updated.ki_atual * 4_000_000)}*`,
    ].join('\n'),
    mentions: mentionIds(updated),
  };
}

function transferZenies(message, argsText, options = {}) {
  void options;
  const sender = getOrCreatePlayerFromMessage(message, { touch: true });
  const targetWhatsappId = getFirstMentionedId(message, argsText);

  if (!targetWhatsappId) {
    return { ok: false, message: 'Use assim: */pix @pessoa valor*' };
  }

  const target = getOrCreatePlayerByWhatsAppId(targetWhatsappId, null, { touch: false });
  if (target.id === sender.id) {
    return { ok: false, message: 'Você não pode transferir Zenies para si mesmo.' };
  }

  const rest = removeFirstMention(argsText);
  const amount = parseAmount(rest.split(/\s+/)[0]);
  if (!amount || amount <= 0) {
    return { ok: false, message: 'Informe um valor válido. Exemplo: */pix @pessoa 50000000*' };
  }

  if (Number(sender.zenies || 0) < amount) {
    return {
      ok: false,
      message: `Saldo insuficiente. Você tem *${money(sender.zenies)} Zenies* disponíveis.`,
    };
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE players
      SET zenies = zenies - ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(amount, sender.id);

    db.prepare(`
      UPDATE players
      SET zenies = zenies + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(amount, target.id);

    db.prepare(`
      INSERT INTO transfer_history (from_player_id, to_player_id, amount)
      VALUES (?, ?, ?)
    `).run(sender.id, target.id, amount);

    recordLedger({
      playerId: sender.id,
      direction: 'saida',
      category: 'pix_enviado',
      amount,
      relatedPlayerId: target.id,
      description: 'PIX enviado',
    });

    recordLedger({
      playerId: target.id,
      direction: 'entrada',
      category: 'pix_recebido',
      amount,
      relatedPlayerId: sender.id,
      description: 'PIX recebido',
    });
  });

  transaction();

  const updatedSender = getPlayerByWhatsAppId(sender.whatsapp_id);
  const updatedTarget = getPlayerByWhatsAppId(target.whatsapp_id);

  return {
    ok: true,
    message: [
      '✅ *PIX DragonVerse realizado!*',
      '',
      `📤 De: ${mentionPlayer(updatedSender)}`,
      `📥 Para: ${mentionPlayer(updatedTarget)}`,
      `💸 Valor: *${money(amount)} Zenies*`,
      '',
      `💰 Seu saldo atual: *${money(updatedSender.zenies)} Zenies*`,
    ].join('\n'),
    mentions: mentionIds(updatedSender, updatedTarget),
  };
}

function depositar(message, argsText) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const amount = parseAmount(argsText.split(/\s+/)[0]);

  if (!amount || amount <= 0) {
    return { ok: false, message: 'Use assim: */depositar valor*\nExemplo: */depositar 50000000*' };
  }

  if (player.zenies < amount) {
    return {
      ok: false,
      message: `Saldo insuficiente. Você tem *${money(player.zenies)} Zenies* disponíveis.`,
    };
  }

  db.prepare(`
    UPDATE players
    SET zenies = zenies - ?,
        deposito = deposito + ?,
        last_deposit_at = CURRENT_TIMESTAMP,
        last_deposit_interest_at = COALESCE(last_deposit_interest_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, amount, player.id);

  recordLedger({
    playerId: player.id,
    direction: 'saida',
    category: 'depositar',
    amount,
    description: 'Depósito na poupança',
  });

  const updated = getPlayerByWhatsAppId(player.whatsapp_id);
  const nextInterestAt = getNextDepositInterestAt(updated);

  return {
    ok: true,
    message: [
      '🏦 *Depósito realizado!*',
      '',
      `📥 Depositado: *${money(amount)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
      `🏦 Total na poupança: *${money(updated.deposito)} Zenies*`,
      `📅 Último depósito: *${formatDateTime(updated.last_deposit_at)}*`,
      `⏳ Próximo rendimento: *${nextInterestAt ? formatDateTime(nextInterestAt) : 'Sem previsão'}*`,
      '',
      'A cada 4 dias, a poupança gera *25% de juros* que vão para seu saldo de Zenies.',
    ].join('\n'),
  };
}

function retirarPoupanca(message, argsText = '') {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const first = String(argsText || '').trim().split(/\s+/)[0];
  const amount = ['tudo', 'all', 'total'].includes(first?.toLowerCase())
    ? Number(player.deposito || 0)
    : parseAmount(first);

  if (!amount || amount <= 0) {
    return { ok: false, message: 'Use assim: */retirarpoupanca valor* ou */retirarpoupanca tudo*' };
  }

  if (Number(player.deposito || 0) < amount) {
    return { ok: false, message: `Saldo insuficiente na poupança. Você tem *${money(player.deposito)} Zenies* depositados.` };
  }

  db.prepare(`
    UPDATE players
    SET deposito = deposito - ?,
        zenies = zenies + ?,
        last_deposit_at = CASE WHEN deposito - ? <= 0 THEN NULL ELSE last_deposit_at END,
        last_deposit_interest_at = CASE WHEN deposito - ? <= 0 THEN NULL ELSE last_deposit_interest_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, amount, amount, amount, player.id);

  recordLedger({
    playerId: player.id,
    direction: 'entrada',
    category: 'retirar_poupanca',
    amount,
    description: 'Retirada da poupança',
  });

  const updated = getPlayerByWhatsAppId(player.whatsapp_id);
  const nextInterestAt = getNextDepositInterestAt(updated);

  return {
    ok: true,
    message: [
      '🏦 *Retirada da poupança realizada!*',
      '',
      `📤 Retirado: *${money(amount)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
      `🏦 Restante na poupança: *${money(updated.deposito)} Zenies*`,
      Number(updated.deposito || 0) > 0 ? `⏳ Próximo rendimento: *${nextInterestAt ? formatDateTime(nextInterestAt) : 'Sem previsão'}*` : '⏳ Próximo rendimento: *Nenhum depósito ativo*',
    ].join('\n'),
  };
}

function saldo(message) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const updated = getPlayerByWhatsAppId(player.whatsapp_id) || player;

  return {
    ok: true,
    message: balanceCaption(updated),
  };
}

function applyDueSalaries() {
  const players = db.prepare(`
    SELECT * FROM players
    WHERE salario > 0 AND last_salary_at IS NOT NULL
  `).all();

  const now = Date.now();
  const intervalMs = SALARY_INTERVAL_DAYS * DAY_MS;
  let updatedCount = 0;
  let totalPaid = 0;

  const updateDate = db.prepare(`
    UPDATE players
    SET last_salary_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const player of players) {
      const last = new Date(player.last_salary_at).getTime();
      if (!Number.isFinite(last)) continue;

      const periods = Math.floor((now - last) / intervalMs);
      if (periods <= 0) continue;

      const payment = periods * Number(player.salario || 0);
      const nextDate = new Date(last + periods * intervalMs).toISOString();
      grantZenies(player.id, payment, 'salario');
      updateDate.run(nextDate, player.id);
      updatedCount += 1;
      totalPaid += payment;
    }
  });

  transaction();
  return { updatedCount, totalPaid };
}

function applyDueDepositInterest() {
  const players = db.prepare(`
    SELECT * FROM players
    WHERE deposito > 0 AND last_deposit_interest_at IS NOT NULL
  `).all();

  const now = Date.now();
  const intervalMs = DEPOSIT_INTEREST_INTERVAL_DAYS * DAY_MS;
  let updatedCount = 0;
  let totalInterest = 0;

  const updateDate = db.prepare(`
    UPDATE players
    SET last_deposit_interest_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const player of players) {
      const last = new Date(player.last_deposit_interest_at).getTime();
      if (!Number.isFinite(last)) continue;

      const periods = Math.floor((now - last) / intervalMs);
      if (periods <= 0) continue;

      const interest = Math.floor(Number(player.deposito || 0) * DEPOSIT_INTEREST_RATE * periods);
      const nextDate = new Date(last + periods * intervalMs).toISOString();
      grantZenies(player.id, interest, 'juros_poupanca');
      updateDate.run(nextDate, player.id);
      updatedCount += 1;
      totalInterest += interest;
    }
  });

  transaction();
  return { updatedCount, totalInterest };
}

function runEconomyMaintenance() {
  const salary = applyDueSalaries();
  const interest = applyDueDepositInterest();
  return { salary, interest };
}

module.exports = {
  addZenies,
  retirarZenies,
  definirKi,
  transferZenies,
  depositar,
  retirarPoupanca,
  saldo,
  applyDueSalaries,
  applyDueDepositInterest,
  runEconomyMaintenance,
};
