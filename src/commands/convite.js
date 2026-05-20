const { convite } = require('../services/inviteService');
const { replyWithMentions } = require('../utils/reply');

async function conviteCommand(message, command, client) {
  const result = convite(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { conviteCommand };
