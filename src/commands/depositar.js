const { depositar } = require('../services/economyService');

async function depositarCommand(message, command) {
  const result = depositar(message, command.argsText);
  await message.reply(result.message);
}

module.exports = { depositarCommand };
