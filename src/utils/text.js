function normalizeCommandName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseCommand(body, prefixes = '/') {
  const text = String(body || '').trim();
  if (!text) return null;

  const prefixList = Array.isArray(prefixes)
    ? prefixes
    : String(prefixes || '/')
        .split(',')
        .map((prefix) => prefix.trim())
        .filter(Boolean);

  const sortedPrefixes = [...prefixList].sort((a, b) => b.length - a.length);

  const usedPrefix = sortedPrefixes.find((prefix) => text.startsWith(prefix));
  if (!usedPrefix) return null;

  const withoutPrefix = text.slice(usedPrefix.length).trim();
  if (!withoutPrefix) return null;

  const parts = withoutPrefix.split(/\s+/);
  const name = normalizeCommandName(parts.shift());
  const args = parts;
  const argsText = args.join(' ');

  return {
    name,
    args,
    argsText,
    raw: withoutPrefix,
    usedPrefix,
  };
}

function slugify(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

module.exports = {
  parseCommand,
  normalizeCommandName,
  normalizeText,
  slugify,
};
