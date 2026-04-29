const { listCharacters } = require('../services/personagemService');

async function personagensCommand(message, command) {
  const universeId = Number(command.args[0]);
  if (!Number.isInteger(universeId)) {
    await message.reply('Use assim: */Personagens 2*');
    return;
  }

  const result = listCharacters(universeId);
  await message.reply(result.message);
}

module.exports = { personagensCommand };
