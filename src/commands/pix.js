const { transferZenies } = require('../services/economyService');
const { replyWithMentions } = require('../utils/reply');

async function pixCommand(message, command, client) {
  const result = transferZenies(message, command.argsText, { commandName: 'pix' });
  await replyWithMentions(message, result, client);
}

module.exports = { pixCommand };
