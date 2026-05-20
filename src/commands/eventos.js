const { eventos, responder, guessLetter, guessWord, pegar, tigrinho, eventRanking, presenceEvent } = require('../services/eventService');
const { replyWithMentions } = require('../utils/reply');

async function eventosCommand(message, command, client) {
  const result = await eventos(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function responderCommand(message, command, client) {
  const result = responder(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function letraCommand(message, command, client) {
  const result = guessLetter(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function chutarCommand(message, command, client) {
  const result = guessWord(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function pegarCommand(message, command, client) {
  const result = pegar(message);
  await replyWithMentions(message, result, client);
}

async function rankEventosCommand(message, command, client) {
  const period = String(command.argsText || '').toLowerCase().includes('seman') ? 'semanal' : 'diario';
  const result = eventRanking(period);
  await replyWithMentions(message, result, client);
}

async function presencaCommand(message, command, client) {
  const result = presenceEvent(message);
  await replyWithMentions(message, result, client);
}

async function tigrinhoCommand(message, command, client) {
  const result = tigrinho(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = {
  eventosCommand,
  responderCommand,
  letraCommand,
  chutarCommand,
  pegarCommand,
  tigrinhoCommand,
  rankEventosCommand,
  presencaCommand,
};
