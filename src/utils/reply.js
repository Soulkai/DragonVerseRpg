function normalizeMentionId(id = '') {
  const raw = String(id || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return `${digits}@c.us`;
}

function normalizeMentionIds(ids = []) {
  return [...new Set(ids.map(normalizeMentionId).filter(Boolean))];
}

async function replyWithMentions(message, result, client = null) {
  const text = result?.message || 'Comando processado.';
  const mentions = normalizeMentionIds(result?.mentions || []);

  if (client && mentions.length > 0) {
    await client.sendMessage(message.from, text, { mentions });
    return;
  }

  await message.reply(text);
}

module.exports = {
  normalizeMentionId,
  normalizeMentionIds,
  replyWithMentions,
};
