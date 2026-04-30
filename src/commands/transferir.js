const { transferZenies } = require('../services/economyService');

async function transferirCommand(message, command) {
  const result = transferZenies(message, command.argsText);
  await message.reply(result.message);
}

module.exports = { transferirCommand };
