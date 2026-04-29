const { eventos, responder, guessLetter, guessWord, pegar } = require('../services/eventService');

async function eventosCommand(message, command) {
  const result = eventos(message, command.argsText);
  await message.reply(result.message);
}

async function responderCommand(message, command) {
  const result = responder(message, command.argsText);
  await message.reply(result.message);
}

async function letraCommand(message, command) {
  const result = guessLetter(message, command.argsText);
  await message.reply(result.message);
}

async function chutarCommand(message, command) {
  const result = guessWord(message, command.argsText);
  await message.reply(result.message);
}

async function pegarCommand(message) {
  const result = pegar(message);
  await message.reply(result.message);
}

module.exports = {
  eventosCommand,
  responderCommand,
  letraCommand,
  chutarCommand,
  pegarCommand,
};
