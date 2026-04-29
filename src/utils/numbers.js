function parseAmount(input = '') {
  const text = String(input)
    .trim()
    .toLowerCase()
    .replace(/zenies?/g, '')
    .replace(/\s+/g, '');

  if (!text) return null;

  const suffixMatch = text.match(/^([\d.,]+)(kkk|kk|k|m|mi|b|bi)$/i);
  if (suffixMatch) {
    const base = Number(suffixMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(base)) return null;

    const suffix = suffixMatch[2].toLowerCase();
    const multiplier = {
      k: 1_000,
      kk: 1_000_000,
      m: 1_000_000,
      mi: 1_000_000,
      kkk: 1_000_000_000,
      b: 1_000_000_000,
      bi: 1_000_000_000,
    }[suffix];

    return Math.floor(base * multiplier);
  }

  const normalized = text.replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return Math.floor(value);
}

function parseInteger(input = '') {
  const value = Number(String(input).replace(/\D/g, ''));
  if (!Number.isInteger(value)) return null;
  return value;
}

module.exports = {
  parseAmount,
  parseInteger,
};
