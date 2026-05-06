const { replyWithMentions } = require('../utils/reply');
const { zMarket, zBuy } = require('../services/zMarketService');

async function zMarketCommand(message, command, client) {
  await replyWithMentions(message, zMarket(), client);
}

async function zBuyCommand(message, command, client) {
  await replyWithMentions(message, zBuy(message, command.argsText), client);
}

module.exports = { zMarketCommand, zBuyCommand };
