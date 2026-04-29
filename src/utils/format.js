const { KI_ATTRIBUTE_GAIN } = require('../data/roles');

function money(value = 0) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatKiLevel(value = 1) {
  return String(Number(value || 1)).padStart(2, '0');
}

function profileCaption(profile) {
  const kiLevel = Number(profile.ki_atual || 1);
  const atributos = kiLevel * KI_ATTRIBUTE_GAIN;

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
    `🏦 *Depósito:* ${money(profile.deposito)}`,
    `🎖️ *Cargo:* ${profile.cargo || 'Lutador Iniciante'}`,
    `🛠️ *Trabalho:* ${profile.trabalho || 'Nenhum'}`,
    `💵 *Salário:* ${money(profile.salario)} a cada 2 dias`,
  ].join('\n');
}

module.exports = { money, formatKiLevel, profileCaption };
