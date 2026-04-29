const { registerCharacter } = require('../services/personagemService');

function splitRegistroArgs(argsText) {
  const match = argsText.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;

  const universeId = Number(match[1]);
  const rest = match[2].trim();

  // Se o último bloco parecer código de resgate, separa do nome do personagem.
  const parts = rest.split(/\s+/);
  const possibleCode = parts[parts.length - 1];
  const hasCode = /^DBV-[A-F0-9]{6}-[A-F0-9]{4}$/i.test(possibleCode);

  return {
    universeId,
    characterName: hasCode ? parts.slice(0, -1).join(' ') : rest,
    rescueCode: hasCode ? possibleCode : null,
  };
}

async function registroCommand(message, command) {
  const parsed = splitRegistroArgs(command.argsText);
  if (!parsed) {
    await message.reply('Use assim: */Registro 2 Goku*\nPara bloqueado: */Registro 2 Bardock CÓDIGO*');
    return;
  }

  const result = registerCharacter(message, parsed.universeId, parsed.characterName, parsed.rescueCode);
  await message.reply(result.message);
}

module.exports = { registroCommand };
