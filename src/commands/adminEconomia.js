const { addZenies, retirarZenies, definirKi } = require('../services/economyService');

async function addZeniesCommand(message, command) {
  const result = await addZenies(message, command.argsText);
  await message.reply(result.message);
}

async function retirarZeniesCommand(message, command) {
  const result = await retirarZenies(message, command.argsText);
  await message.reply(result.message);
}

async function definirKiCommand(message, command) {
  const result = await definirKi(message, command.argsText);
  await message.reply(result.message);
}

module.exports = {
  addZeniesCommand,
  retirarZeniesCommand,
  definirKiCommand,
};
