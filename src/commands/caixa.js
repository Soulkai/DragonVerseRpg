const { caixa } = require('../services/boxService');
const { replyWithMentions } = require('../utils/reply');

async function caixaCommand(message, command, client) {
  const result = caixa(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { caixaCommand };
