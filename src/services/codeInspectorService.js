const db = require('../database/db');
const { money, formatKiLevel, formatDateTime } = require('../utils/format');

function normalizeCodeInput(argsText = '') {
  return String(argsText || '')
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase() || '';
}

function statusEmoji(text) {
  if (text === 'disponivel') return '✅';
  if (text === 'usado') return '⚫';
  if (text === 'esgotado') return '⚫';
  if (text === 'inativo') return '🔴';
  return 'ℹ️';
}

function genericRewardLabel(code) {
  if (!code) return 'Desconhecida';

  if (code.type === 'desconto') {
    return `${Number(code.value || 0)}% de desconto na próxima compra`;
  }

  if (code.type === 'zenies') {
    return `${money(code.value)} Zenies`;
  }

  if (code.type === 'ki') {
    return `Define o Ki para pelo menos Ki ${formatKiLevel(code.value)}`;
  }

  return `Tipo desconhecido (${code.type})`;
}

function genericTypeLabel(type) {
  if (type === 'desconto') return 'Desconto na próxima compra';
  if (type === 'zenies') return 'Zenies';
  if (type === 'ki') return 'Ki';
  return type || 'Desconhecido';
}

function inspectGenericCode(codeText) {
  const code = db.prepare(`
    SELECT *
    FROM generic_codes
    WHERE UPPER(code) = ?
    LIMIT 1
  `).get(codeText);

  if (!code) return null;

  const realRedeemedCount = db.prepare(`
    SELECT COUNT(*) AS total
    FROM generic_code_redemptions
    WHERE code_id = ?
  `).get(code.id)?.total || 0;

  const redeemedCount = Math.max(Number(code.redeemed_count || 0), Number(realRedeemedCount || 0));
  const maxRedemptions = Number(code.max_redemptions || 0);
  const remaining = Math.max(0, maxRedemptions - redeemedCount);
  const active = Number(code.is_active || 0) === 1;

  let status = 'disponivel';
  let statusText = 'Disponível para resgate';
  if (!active) {
    status = 'inativo';
    statusText = 'Inativo';
  } else if (remaining <= 0) {
    status = 'esgotado';
    statusText = 'Esgotado / todos os resgates foram usados';
  }

  return {
    ok: true,
    message: [
      '╭━━⪩ 🎟️ *INSPEÇÃO DE CÓDIGO* ⪨━━',
      '▢',
      `▢ • Código: *${code.code}*`,
      '▢ • Origem: */codes*',
      `▢ • Tipo: *${genericTypeLabel(code.type)}*`,
      `▢ • Status: ${statusEmoji(status)} *${statusText}*`,
      '▢',
      `▢ • Recompensa: *${genericRewardLabel(code)}*`,
      `▢ • Como usar: */resgatar ${code.code}*`,
      '▢',
      `▢ • Usos máximos: *${money(maxRedemptions)}*`,
      `▢ • Usos feitos: *${money(redeemedCount)}*`,
      `▢ • Usos restantes: *${money(remaining)}*`,
      `▢ • Criado em: *${formatDateTime(code.created_at)}*`,
      '▢',
      '╰━━─「🎟️」─━━',
    ].join('\n'),
  };
}

function inspectRescueCode(codeText) {
  const code = db.prepare(`
    SELECT
      rc.*,
      u.name AS universe_name,
      c.name AS representative_character_name,
      p.phone AS redeemed_phone,
      p.display_name AS redeemed_display_name
    FROM rescue_codes rc
    JOIN universes u ON u.id = rc.universe_id
    JOIN characters c ON c.id = rc.character_id
    LEFT JOIN players p ON p.whatsapp_id = rc.redeemed_by
    WHERE UPPER(rc.code) = ?
    LIMIT 1
  `).get(codeText);

  if (!code) return null;

  const used = Boolean(code.used_at);
  const universal = Number(code.is_universal || 0) === 1;
  const characterName = code.character_name || code.representative_character_name;
  const status = used ? 'usado' : 'disponivel';
  const statusText = used ? 'Usado' : 'Disponível para resgate';
  const redeemedBy = code.redeemed_phone
    ? `@${String(code.redeemed_phone).replace(/\D/g, '')}`
    : code.redeemed_by || 'Não usado';

  return {
    ok: true,
    mentions: code.redeemed_by ? [code.redeemed_by] : [],
    message: [
      '╭━━⪩ 🔑 *INSPEÇÃO DE CÓDIGO* ⪨━━',
      '▢',
      `▢ • Código: *${code.code}*`,
      '▢ • Origem: */codigoresgate*',
      '▢ • Tipo: *Resgate de personagem bloqueado*',
      `▢ • Status: ${statusEmoji(status)} *${statusText}*`,
      '▢',
      `▢ • Validade: *${universal ? 'qualquer universo' : `somente Universo ${code.universe_id}`}*`,
      `▢ • Personagem: *${characterName}*`,
      `▢ • Recompensa: *Libera ${characterName} ${universal ? 'em qualquer universo' : `no Universo ${code.universe_id}`}*`,
      '▢',
      universal
        ? `▢ • Como usar no registro: */Registro 2 ${characterName} ${code.code}*\n▢   ↳ Troque o 2 pelo universo desejado.`
        : `▢ • Como usar no registro: */Registro ${code.universe_id} ${characterName} ${code.code}*`,
      `▢ • Como usar na troca: */trocarpersonagem ${characterName} ${code.code}*`,
      '▢',
      `▢ • Criado em: *${formatDateTime(code.created_at)}*`,
      used ? `▢ • Usado em: *${formatDateTime(code.used_at)}*` : null,
      used ? `▢ • Usado por: *${redeemedBy}*` : null,
      '▢',
      '╰━━─「🔑」─━━',
    ].filter(Boolean).join('\n'),
  };
}

function inspectCode(argsText = '') {
  const codeText = normalizeCodeInput(argsText);
  if (!codeText) {
    return {
      ok: false,
      message: 'Use assim: */inspecionar CODIGO*\nExemplo: */inspecionar DBV-ABC123-ABCD*',
    };
  }

  const rescue = inspectRescueCode(codeText);
  if (rescue) return rescue;

  const generic = inspectGenericCode(codeText);
  if (generic) return generic;

  return {
    ok: false,
    message: [
      '❌ *Código inválido.*',
      '',
      `Não encontrei nenhum código com valor: *${codeText}*`,
      '',
      'Esse comando inspeciona códigos gerados por:',
      '• */codigoresgate*',
      '• */codes*',
    ].join('\n'),
  };
}

module.exports = {
  inspectCode,
};
