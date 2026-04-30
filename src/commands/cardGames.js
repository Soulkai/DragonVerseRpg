const { blackjack, poker, truco } = require('../services/cardGameService');

async function blackjackCommand(message, command) {
  const result = await blackjack(message, command.argsText);
  await message.reply(result.message);
}

async function pokerCommand(message, command, client) {
  const result = await poker(message, command.argsText, client);
  await message.reply(result.message);
}

async function trucoCommand(message, command, client) {
  const result = await truco(message, command.argsText, client);
  await message.reply(result.message);
}

module.exports = {
  blackjackCommand,
  pokerCommand,
  trucoCommand,
};
