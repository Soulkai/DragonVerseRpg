const { addCharacterToUniverse, removeCharacterFromUniverse } = require('../services/personagemService');

async function addPersonagemCommand(message, command) {
  const result = await addCharacterToUniverse(message, command.argsText);
  await message.reply(result.message);
}

async function rmvPersonagemCommand(message, command) {
  const result = await removeCharacterFromUniverse(message, command.argsText);
  await message.reply(result.message);
}

module.exports = {
  addPersonagemCommand,
  rmvPersonagemCommand,
};
