const { addCargo } = require('../services/cargoService');

async function addCargoCommand(message, command) {
  const result = addCargo(message, command.argsText);
  await message.reply(result.message);
}

module.exports = { addCargoCommand };
