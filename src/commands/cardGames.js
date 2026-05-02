const { blackjack, poker, truco, regrasCartas } = require('../services/cardGameService');
const { replyWithMentions } = require('../utils/reply');

async function blackjackCommand(message, command, client) {
  const result = await blackjack(message, command.argsText, client);
  await replyWithMentions(message, result, client);
}

async function pokerCommand(message, command, client) {
  const result = await poker(message, command.argsText, client);
  await replyWithMentions(message, result, client);
}

async function trucoCommand(message, command, client) {
  const result = await truco(message, command.argsText, client);
  await replyWithMentions(message, result, client);
}

async function regrasCommand(message, command, client) {
  const result = regrasCartas(command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = {
  blackjackCommand,
  pokerCommand,
  trucoCommand,
  regrasCommand,
  replyWithMentions,
};
