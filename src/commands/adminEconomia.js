const { addZenies, retirarZenies, definirKi } = require('../services/economyService');
const { replyWithMentions } = require('../utils/reply');

async function addZeniesCommand(message, command, client) {
  const result = await addZenies(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function retirarZeniesCommand(message, command, client) {
  const result = await retirarZenies(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function definirKiCommand(message, command, client) {
  const result = await definirKi(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = {
  addZeniesCommand,
  retirarZeniesCommand,
  definirKiCommand,
};
