const { extrato } = require('../services/ledgerService');
const { replyWithMentions } = require('../utils/reply');

async function extratoCommand(message, command, client) {
  const result = extrato(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { extratoCommand };
