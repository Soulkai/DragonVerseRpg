const { blackjack, poker, truco } = require('../services/cardGameService');

function normalizeMentionId(id = '') {
  const raw = String(id || '').trim();
  if (!raw) return null;

  // Já está no formato correto: 5567...@c.us ou ...@lid
  if (raw.includes('@')) return raw;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  return `${digits}@c.us`;
}

function normalizeMentionIds(ids = []) {
  return [...new Set(
    ids
      .map(normalizeMentionId)
      .filter(Boolean)
  )];
}

async function replyWithMentions(message, result, client = null) {
  if (client && result?.mentions && result.mentions.length > 0) {
    const mentions = normalizeMentionIds(result.mentions);

    await client.sendMessage(message.from, result.message, {
      mentions,
    });

    return;
  }

  await message.reply(result.message);
}

async function blackjackCommand(message, command, client) {
  const result = await blackjack(message, command.argsText, client);
  await replyWithMentions(message, result, client);
}

async function pokerCommand(message, command, client) {
  const result = await poker(message, command.argsText, client);
  await replyWithMentions(message, result, client);
}

async function trucoCommand(message, command, client) {
  const result = await truco(message, command.argsText, client);
  await replyWithMentions(message, result, client);
}

module.exports = {
  blackjackCommand,
  pokerCommand,
  trucoCommand,
};
