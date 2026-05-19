const { formatShop } = require('../services/shopService');

async function lojaCommand(message) {
  const result = formatShop();
  await message.reply(result.message);
}

module.exports = { lojaCommand };
