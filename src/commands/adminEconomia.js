const { addZenies, definirKi } = require('../services/economyService');

async function addZeniesCommand(message, command) {
  const result = addZenies(message, command.argsText);
  await message.reply(result.message);
}

async function definirKiCommand(message, command) {
  const result = definirKi(message, command.argsText);
  await message.reply(result.message);
}

module.exports = {
  addZeniesCommand,
  definirKiCommand,
};
