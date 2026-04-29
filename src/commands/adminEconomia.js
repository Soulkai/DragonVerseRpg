const { addZenies, retirarZenies, definirKi } = require('../services/economyService');

async function addZeniesCommand(message, command) {
  const result = addZenies(message, command.argsText);
  await message.reply(result.message);
}

async function retirarZeniesCommand(message, command) {
  const result = retirarZenies(message, command.argsText);
  await message.reply(result.message);
}

async function definirKiCommand(message, command) {
  const result = definirKi(message, command.argsText);
  await message.reply(result.message);
}

module.exports = {
  addZeniesCommand,
  retirarZeniesCommand,
  definirKiCommand,
};
