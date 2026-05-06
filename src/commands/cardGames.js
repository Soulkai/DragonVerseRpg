const { blackjack, poker, truco, ltruco, regrasCartas } = require('../services/cardGameService');
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

async function ltrucoCommand(message, command, client) {
  const result = await ltruco(message, command.argsText, client);
  await replyWithMentions(message, result, client);
}


async function trucoAnyCommand(message, command, client) {
  const sujo = await truco(message, command.argsText, client);
  if (!sujo.ok && String(sujo.message || '').includes('Não existe mesa de Truco ativa')) {
    const limpo = await ltruco(message, command.argsText, client);
    await replyWithMentions(message, limpo, client);
    return;
  }
  await replyWithMentions(message, sujo, client);
}

async function regrasCommand(message, command, client) {
  const result = regrasCartas(command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = {
  blackjackCommand,
  pokerCommand,
  trucoCommand,
  ltrucoCommand,
  trucoAnyCommand,
  regrasCommand,
  replyWithMentions,
};
