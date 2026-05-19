const { listRoles } = require('../services/cargoService');

async function cargosCommand(message) {
  const result = listRoles();
  await message.reply(result.message);
}

module.exports = { cargosCommand };
