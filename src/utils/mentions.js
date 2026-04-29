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

function removeFirstMention(argsText = '') {
  return String(argsText).replace(/@\d{8,20}/, '').trim();
}

module.exports = {
  cleanWhatsAppId,
  getFirstMentionedId,
  removeFirstMention,
};
