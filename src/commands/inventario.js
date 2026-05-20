const { getInventory } = require('../services/shopService');

async function inventarioCommand(message) {
  const result = getInventory(message);
  await message.reply(result.message);
}

module.exports = { inventarioCommand };
