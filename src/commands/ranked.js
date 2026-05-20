const { replyWithMentions } = require('../utils/reply');
const ranked = require('../services/rankedService');

async function rankeadaCommand(message, command, client) {
  const result = ranked.rankedRules();
  await replyWithMentions(message, result, client);
}

async function listaRankCommand(message, command, client) {
  const result = ranked.listRanked();
  await replyWithMentions(message, result, client);
}

async function iRankCommand(message, command, client) {
  const result = ranked.joinRanked(message);
  await replyWithMentions(message, result, client);
}

async function desafioCommand(message, command, client) {
  const result = ranked.createChallenge(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function aceitarDesafioCommand(message, command, client) {
  const result = ranked.acceptChallenge(message);
  await replyWithMentions(message, result, client);
}

async function recusarDesafioCommand(message, command, client) {
  const result = ranked.refuseChallenge(message);
  await replyWithMentions(message, result, client);
}

async function registrarVencedorRankedCommand(message, command, client) {
  const result = await ranked.registerWinner(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function removerRankCommand(message, command, client) {
  const result = await ranked.removeRankedPlayer(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = {
  rankeadaCommand,
  listaRankCommand,
  iRankCommand,
  desafioCommand,
  aceitarDesafioCommand,
  recusarDesafioCommand,
  registrarVencedorRankedCommand,
  removerRankCommand,
};
