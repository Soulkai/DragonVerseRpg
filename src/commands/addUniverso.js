const { addUniverso } = require('../services/universeService');

async function addUniversoCommand(message, command) {
  const result = await addUniverso(message, command.argsText);
  await message.reply(result.message);
}

module.exports = { addUniversoCommand };
