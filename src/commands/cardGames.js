const { blackjack, poker, truco } = require('../services/cardGameService');

async function replyWithMentions(message, client, result) {
  if (!result?.message) return;

  const mentionIds = Array.isArray(result.mentions)
    ? [...new Set(result.mentions.filter(Boolean))]
    : [];

  if (!mentionIds.length || !client?.getContactById) {
    await message.reply(result.message);
    return;
  }

  try {
    const contacts = [];
    for (const id of mentionIds) {
      try {
        contacts.push(await client.getContactById(id));
      } catch (error) {
        console.error(`[mentions] Não consegui carregar contato ${id}:`, error.message);
      }
    }

    if (contacts.length) {
      await message.reply(result.message, undefined, { mentions: contacts });
      return;
    }
  } catch (error) {
    console.error('[mentions] Falha ao responder com marcações:', error.message);
  }

  await message.reply(result.message);
}

async function blackjackCommand(message, command, client) {
  const result = await blackjack(message, command.argsText);
  await replyWithMentions(message, client, result);
}

async function pokerCommand(message, command, client) {
  const result = await poker(message, command.argsText, client);
  await replyWithMentions(message, client, result);
}

async function trucoCommand(message, command, client) {
  const result = await truco(message, command.argsText, client);
  await replyWithMentions(message, client, result);
}

module.exports = {
  blackjackCommand,
  pokerCommand,
  trucoCommand,
};
