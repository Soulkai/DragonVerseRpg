function cleanWhatsAppId(value = '') {
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes('@')) return raw;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return `${digits}@c.us`;
}

function getFirstMentionedId(message, argsText = '') {
  if (Array.isArray(message.mentionedIds) && message.mentionedIds.length > 0) {
    return cleanWhatsAppId(message.mentionedIds[0]);
  }

  if (Array.isArray(message._data?.mentionedJidList) && message._data.mentionedJidList.length > 0) {
    return cleanWhatsAppId(message._data.mentionedJidList[0]);
  }

  const match = String(argsText).match(/@(\d{8,20})/);
  if (match) return cleanWhatsAppId(match[1]);

  return null;
}

function getMentionedIds(message, argsText = '') {
  const ids = [];
  if (Array.isArray(message.mentionedIds)) ids.push(...message.mentionedIds);
  if (Array.isArray(message._data?.mentionedJidList)) ids.push(...message._data.mentionedJidList);

  const text = String(argsText || '');
  for (const match of text.matchAll(/@(\d{8,20})/g)) {
    ids.push(match[1]);
  }

  return [...new Set(ids.map(cleanWhatsAppId).filter(Boolean))];
}

function removeFirstMention(argsText = '') {
  return String(argsText).replace(/@\d{8,20}/, '').trim();
}

function removeAllMentions(argsText = '') {
  return String(argsText).replace(/@\d{8,20}/g, '').trim();
}

function mentionTagFromId(whatsappId = '') {
  const id = String(whatsappId || '').trim();
  if (!id) return '';
  return id.split('@')[0].replace(/[^0-9a-zA-Z]/g, '');
}

function mentionPlayer(player) {
  const tag = mentionTagFromId(player?.whatsapp_id) || String(player?.phone || '').replace(/\D/g, '');
  return tag ? `@${tag}` : '@jogador';
}

function mentionIds(...players) {
  return [...new Set(players.flat().map((player) => player?.whatsapp_id || player).filter(Boolean))];
}

module.exports = {
  cleanWhatsAppId,
  getFirstMentionedId,
  getMentionedIds,
  removeFirstMention,
  removeAllMentions,
  mentionTagFromId,
  mentionPlayer,
  mentionIds,
};
