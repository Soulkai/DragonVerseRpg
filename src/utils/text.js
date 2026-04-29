function normalizeText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function slugify(text = '') {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getSenderNumber(message) {
  const raw = message.author || message.from || '';
  return raw.split('@')[0].replace(/\D/g, '');
}

function parseCommand(body = '', prefix = '/') {
  const text = body.trim();
  if (!text.startsWith(prefix)) return null;

  const withoutPrefix = text.slice(prefix.length).trim();
  const firstSpace = withoutPrefix.search(/\s/);

  if (firstSpace === -1) {
    return {
      name: normalizeText(withoutPrefix),
      argsText: '',
      args: [],
    };
  }

  const name = withoutPrefix.slice(0, firstSpace);
  const argsText = withoutPrefix.slice(firstSpace + 1).trim();

  return {
    name: normalizeText(name),
    argsText,
    args: argsText ? argsText.split(/\s+/) : [],
  };
}

module.exports = {
  normalizeText,
  slugify,
  getSenderNumber,
  parseCommand,
};
