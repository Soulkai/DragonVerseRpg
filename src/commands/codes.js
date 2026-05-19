const { createGenericCode, redeemGenericCode } = require('../services/codeService');
const { replyWithMentions } = require('../utils/reply');

async function codesCommand(message, command, client) {
  const result = await createGenericCode(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function resgatarCommand(message, command, client) {
  const result = redeemGenericCode(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { codesCommand, resgatarCommand };
