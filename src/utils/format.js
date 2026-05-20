const {
  KI_ATTRIBUTE_GAIN,
  DAY_MS,
  DEPOSIT_INTEREST_INTERVAL_DAYS,
  DEPOSIT_INTEREST_RATE,
} = require('../data/roles');
const settings = require('../config/settings');

function money(value = 0) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatKiLevel(value = 1) {
  return String(Number(value || 1)).padStart(2, '0');
}

function formatDateTime(value) {
  if (!value) return 'Não registrado';

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Não registrado';

  return date.toLocaleString('pt-BR', {
    timeZone: settings.timezone || 'America/Campo_Grande',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNextDepositInterestAt(profile) {
  const deposito = Number(profile?.deposito || 0);
  if (deposito <= 0) return null;

  const base = profile.last_deposit_interest_at || profile.last_deposit_at;
  if (!base) return null;

  const last = new Date(base);
  if (!Number.isFinite(last.getTime())) return null;

  return new Date(last.getTime() + DEPOSIT_INTEREST_INTERVAL_DAYS * DAY_MS);
}

function depositStatusLines(profile) {
  const deposito = Number(profile?.deposito || 0);

  if (deposito <= 0) {
    return [
      '🏦 *Poupança:* 0 Zenies',
      '📅 *Último depósito:* Nenhum depósito ativo',
      '⏳ *Próximo rendimento:* Nenhum depósito ativo',
    ];
  }

  const nextInterestAt = getNextDepositInterestAt(profile);
  const expectedInterest = Math.floor(deposito * DEPOSIT_INTEREST_RATE);

  return [
    `🏦 *Poupança:* ${money(deposito)} Zenies`,
    `📅 *Último depósito:* ${formatDateTime(profile.last_deposit_at || profile.last_deposit_interest_at)}`,
    `⏳ *Próximo rendimento:* ${nextInterestAt ? formatDateTime(nextInterestAt) : 'Sem previsão'}`,
    `💵 *Juros previstos:* ${money(expectedInterest)} Zenies`,
  ];
}

function balanceCaption(profile) {
  return [
    '╭━━⪩ 💰 *SALDO DRAGONVERSE* ⪨━━',
    '▢',
    `▢ • Zenies: *${money(profile.zenies)}*`,
    ...depositStatusLines(profile).map((line) => `▢ • ${line.replace(/\*/g, '')}`),
    '▢',
    '╰━━─「🏦」─━━',
  ].join('\n');
}

function profileCaption(profile) {
  const kiLevel = Number(profile.ki_atual || 1);
  const atributos = kiLevel * KI_ATTRIBUTE_GAIN;
  const depositLines = depositStatusLines(profile);

  return [
    '┏━━━━━━━━━━━━━┓',
    '        Perfil DragonVerse',
    '┗━━━━━━━━━━━━━┛',
    '',
    `👤 *Personagem:* ${profile.character_name || 'Nenhum'}`,
    `🌌 *Universo:* ${profile.universe_id || 'Nenhum'}`,
    `🔥 *Ki Atual:* Ki ${formatKiLevel(kiLevel)}`,
    `💪 *Atributos Totais:* ${money(atributos)}`,
    `💰 *Zenies:* ${money(profile.zenies)}`,
    ...depositLines,
    `🎖️ *Cargo:* ${profile.cargo || 'Lutador Iniciante'}`,
    `🛠️ *Trabalho:* ${profile.trabalho || 'Nenhum'}`,
    `💵 *Salário:* ${money(profile.salario)} a cada 2 dias`,
  ].join('\n');
}

module.exports = {
  money,
  formatKiLevel,
  formatDateTime,
  getNextDepositInterestAt,
  depositStatusLines,
  balanceCaption,
  profileCaption,
};
