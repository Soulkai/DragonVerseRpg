const { loanCommand } = require('../services/debtService');
const { replyWithMentions } = require('../utils/reply');

async function emprestimoCommand(message, command, client) {
  const result = loanCommand(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { emprestimoCommand };
