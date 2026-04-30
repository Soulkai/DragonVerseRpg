const { transferZenies } = require('../services/economyService');

async function pixCommand(message, command) {
  const result = transferZenies(message, command.argsText, { commandName: 'pix' });
  await message.reply(result.message);
}

module.exports = { pixCommand };
