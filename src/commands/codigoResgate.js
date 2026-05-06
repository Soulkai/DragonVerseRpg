const { isAdmin } = require('../utils/admin');
const { generateRescueCode } = require('../services/personagemService');

function parseCodigoArgs(argsText) {
  const text = argsText.trim();
  if (!text) return null;

  const matchWithUniverse = text.match(/^(\d+)\s+(.+)$/);
  if (matchWithUniverse) {
    return {
      universeId: Number(matchWithUniverse[1]),
      characterName: matchWithUniverse[2].trim(),
    };
  }

  return {
    universeId: null,
    characterName: text,
  };
}

async function codigoResgateCommand(message, command) {
  if (!(await isAdmin(message))) {
    await message.reply('Apenas administradores podem gerar código de resgate.');
    return;
  }

  const parsed = parseCodigoArgs(command.argsText);
  if (!parsed) {
    await message.reply([
      'Use assim:',
      '*/codigoresgate Bardock* — gera código válido em qualquer universo.',
      '*/codigoresgate 2 Bardock* — gera código válido apenas no Universo 2.',
    ].join('\n'));

    return;
  }

  const result = generateRescueCode(message, parsed.universeId, parsed.characterName);
  await message.reply(result.message);
}

module.exports = { codigoResgateCommand };
