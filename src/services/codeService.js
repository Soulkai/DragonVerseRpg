const crypto = require('crypto');
const db = require('../database/db');
const { isAdmin } = require('../utils/admin');
const { money, formatKiLevel } = require('../utils/format');
const { getOrCreatePlayerFromMessage, getWhatsAppIdFromMessage } = require('./playerService');
const { grantZenies } = require('./rewardService');

function normalizeType(type = '') {
  const value = String(type || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['desconto', 'discount'].includes(value)) return 'desconto';
  if (['zenies', 'zennies', 'zenie', 'zennie', 'dinheiro'].includes(value)) return 'zenies';
  if (['ki'].includes(value)) return 'ki';
  return null;
}

function createCodeValue(type) {
  const prefix = type === 'desconto' ? 'DESC' : type === 'ki' ? 'KI' : 'ZEN';
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

async function createGenericCode(message, argsText = '') {
  if (!(await isAdmin(message))) {
    const p = getOrCreatePlayerFromMessage(message, { touch: true });
    if (!['A.S', 'S.M'].includes(p.cargo_id)) {
      return { ok: false, message: 'Apenas administradores, Autoridade Suprema ou Supremo Ministro podem criar codes.' };
    }
  }

  const parts = String(argsText || '').trim().split(/\s+/).filter(Boolean);
  const type = normalizeType(parts[0]);
  const value = Number(parts[1]);
  const quantity = Number(parts[2]);

  if (!type || !Number.isFinite(value) || value <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: 'Use assim: */codes tipo valor quantidade*\nTipos: desconto, zenies, ki.' };
  }

  if (type === 'desconto' && (value < 1 || value > 100)) {
    return { ok: false, message: 'O desconto precisa ser entre 1 e 100.' };
  }
  if (type === 'ki' && (value < 1 || value > 10 || !Number.isInteger(value))) {
    return { ok: false, message: 'O código de Ki precisa ter valor de 1 a 10.' };
  }

  let code;
  let ok = false;
  while (!ok) {
    code = createCodeValue(type);
    try {
      db.prepare(`
        INSERT INTO generic_codes (code, type, value, max_redemptions, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(code, type, Math.floor(value), quantity, getWhatsAppIdFromMessage(message));
      ok = true;
    } catch (error) {
      if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error;
    }
  }

  const label = type === 'desconto'
    ? `${value}% de desconto nas próximas compras`
    : type === 'ki'
      ? `Ki ${formatKiLevel(value)}`
      : `${money(value)} Zenies`;

  return {
    ok: true,
    message: [
      '🎟️ *Code DragonVerse criado!*',
      '',
      `Tipo: *${type}*`,
      `Valor: *${label}*`,
      `Quantidade de usos: *${quantity}*`,
      `Código: *${code}*`,
      '',
      `Para usar: */resgatar ${code}*`,
    ].join('\n'),
  };
}

function redeemGenericCode(message, argsText = '') {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const codeText = String(argsText || '').trim().split(/\s+/)[0]?.toUpperCase();
  if (!codeText) return { ok: false, message: 'Use assim: */resgatar CODIGO*' };

  const code = db.prepare('SELECT * FROM generic_codes WHERE UPPER(code) = ? AND is_active = 1').get(codeText);
  if (!code) return { ok: false, message: 'Código não encontrado ou inativo.' };
  if (Number(code.redeemed_count || 0) >= Number(code.max_redemptions || 0)) {
    return { ok: false, message: 'Esse código já atingiu o limite de resgates.' };
  }

  const already = db.prepare('SELECT id FROM generic_code_redemptions WHERE code_id = ? AND player_id = ?').get(code.id, player.id);
  if (already) return { ok: false, message: 'Você já resgatou esse código.' };

  let rewardText = '';
  db.transaction(() => {
    db.prepare(`
      INSERT INTO generic_code_redemptions (code_id, player_id)
      VALUES (?, ?)
    `).run(code.id, player.id);

    db.prepare(`
      UPDATE generic_codes
      SET redeemed_count = redeemed_count + 1
      WHERE id = ?
    `).run(code.id);

    if (code.type === 'zenies') {
      grantZenies(player.id, code.value, 'generic_code_zenies');
      rewardText = `+${money(code.value)} Zenies`;
    } else if (code.type === 'desconto') {
      db.prepare(`
        INSERT INTO player_discounts (player_id, percent, uses)
        VALUES (?, ?, 1)
        ON CONFLICT(player_id) DO UPDATE SET
          percent = MAX(percent, excluded.percent),
          uses = uses + 1,
          updated_at = CURRENT_TIMESTAMP
      `).run(player.id, code.value);
      rewardText = `${code.value}% de desconto na próxima compra`;
    } else if (code.type === 'ki') {
      db.prepare(`
        UPDATE players
        SET ki_atual = MAX(ki_atual, ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(code.value, player.id);
      rewardText = `Ki definido para pelo menos Ki ${formatKiLevel(code.value)}`;
    }
  })();

  const refreshed = db.prepare('SELECT * FROM generic_codes WHERE id = ?').get(code.id);
  return {
    ok: true,
    message: [
      '✅ *Código resgatado!*',
      '',
      `🎁 Recompensa: *${rewardText}*`,
      `Usos restantes: *${Math.max(0, refreshed.max_redemptions - refreshed.redeemed_count)}*`,
    ].join('\n'),
  };
}

module.exports = {
  createGenericCode,
  redeemGenericCode,
};
