const { inspectCode } = require('../services/codeInspectorService');
const { replyWithMentions } = require('../utils/reply');

async function inspecionarCommand(message, command, client) {
  const result = inspectCode(command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { inspecionarCommand };
