const { depositar, retirarPoupanca } = require('../services/economyService');
const { replyWithMentions } = require('../utils/reply');

async function depositarCommand(message, command, client) {
  const result = depositar(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function retirarPoupancaCommand(message, command, client) {
  const result = retirarPoupanca(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { depositarCommand, retirarPoupancaCommand };
