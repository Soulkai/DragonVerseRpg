const { addCargo } = require('../services/cargoService');
const { replyWithMentions } = require('../utils/reply');

async function addCargoCommand(message, command, client) {
  const result = await addCargo(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = { addCargoCommand };
