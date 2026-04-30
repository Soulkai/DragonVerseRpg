const db = require('../database/db');
const { isAdmin } = require('../utils/admin');
const { getFirstMentionedId, removeFirstMention } = require('../utils/mentions');
const { parseAmount, parseInteger } = require('../utils/numbers');
const { money, formatKiLevel } = require('../utils/format');
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

  return {
    ok: true,
    message: [
      '✅ *Zenies adicionados!*',
      '',
      `👤 Jogador: @${updated.phone}`,
      `➕ Valor: *${money(amount)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].join('\n'),
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

  return {
    ok: true,
    message: [
      '✅ *Zenies retirados!*',
      '',
      `👤 Jogador: @${updated.phone}`,
      `➖ Valor solicitado: *${money(amount)} Zenies*`,
      `💸 Valor retirado: *${money(discount)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].join('\n'),
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
      `👤 Jogador: @${updated.phone}`,
      `🔥 Ki atual: *Ki ${formatKiLevel(updated.ki_atual)}*`,
      `💪 Atributos totais: *${money(updated.ki_atual * 4_000_000)}*`,
    ].join('\n'),
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
  });

  transaction();

  const updatedSender = getPlayerByWhatsAppId(sender.whatsapp_id);
  const updatedTarget = getPlayerByWhatsAppId(target.whatsapp_id);

  return {
    ok: true,
    message: [
      '✅ *PIX DragonVerse realizado!*',
      '',
      `📤 De: @${updatedSender.phone}`,
      `📥 Para: @${updatedTarget.phone}`,
      `💸 Valor: *${money(amount)} Zenies*`,
      '',
      `💰 Seu saldo atual: *${money(updatedSender.zenies)} Zenies*`,
    ].join('\n'),
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
        last_deposit_interest_at = COALESCE(last_deposit_interest_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, amount, player.id);

  const updated = getPlayerByWhatsAppId(player.whatsapp_id);

  return {
    ok: true,
    message: [
      '🏦 *Depósito realizado!*',
      '',
      `📥 Depositado: *${money(amount)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
      `🏦 Total no depósito: *${money(updated.deposito)} Zenies*`,
      '',
      'A cada 4 dias, o depósito gera *25% de juros* que vão para seu saldo de Zenies.',
    ].join('\n'),
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

  const update = db.prepare(`
    UPDATE players
    SET zenies = zenies + ?,
        last_salary_at = ?,
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
      update.run(payment, nextDate, player.id);
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

  const update = db.prepare(`
    UPDATE players
    SET zenies = zenies + ?,
        last_deposit_interest_at = ?,
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
      update.run(interest, nextDate, player.id);
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
  applyDueSalaries,
  applyDueDepositInterest,
  runEconomyMaintenance,
};
