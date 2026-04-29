const { comprar } = require('../services/shopService');

async function comprarCommand(message, command) {
  const result = comprar(message, command.argsText);
  await message.reply(result.message);
}

module.exports = { comprarCommand };
