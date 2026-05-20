const { vitoria, bountyStatus } = require('../services/bountyService');
const { replyWithMentions } = require('../utils/reply');

async function vitoriaCommand(message, command, client) {
  const result = await vitoria(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function bountyCommand(message, command, client) {
  const result = await bountyStatus(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { vitoriaCommand, bountyCommand };
