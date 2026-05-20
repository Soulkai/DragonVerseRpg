const settings = require('../config/settings');

function normalizeIdentifier(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^whatsapp:/, '')
    .replace(/\s+/g, '');
}

function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function buildComparableIds(value = '') {
  const raw = normalizeIdentifier(value);
  if (!raw) return [];

  const ids = new Set();
  ids.add(raw);

  const withoutSuffix = raw.split('@')[0];
  if (withoutSuffix) ids.add(withoutSuffix);

  const digits = onlyDigits(withoutSuffix || raw);
  if (digits) {
    ids.add(digits);
    ids.add(`${digits}@c.us`);
    ids.add(`${digits}@s.whatsapp.net`);
  }

  return [...ids].filter(Boolean);
}

function getConfiguredAdminIds() {
  const ids = new Set();

  for (const admin of settings.adminNumbers) {
    for (const comparable of buildComparableIds(admin)) {
      ids.add(comparable);
    }
  }

  return ids;
}

function addMessageIdCandidates(message, candidates) {
  const possibleValues = [
    message?.author,
    message?.from,
    message?.id?.participant,
    message?.id?.participant?._serialized,
    message?._data?.author,
    message?._data?.id?.participant,
    message?._data?.id?.participant?._serialized,
  ];

  for (const value of possibleValues) {
    if (!value) continue;
    for (const comparable of buildComparableIds(value)) {
      candidates.add(comparable);
    }
  }
}

function addContactIdCandidates(contact, candidates) {
  const possibleValues = [
    contact?.id?._serialized,
    contact?.id?.user,
    contact?.number,
  ];

  for (const value of possibleValues) {
    if (!value) continue;
    for (const comparable of buildComparableIds(value)) {
      candidates.add(comparable);
    }
  }
}

async function getSenderAdminCandidates(message) {
  const candidates = new Set();
  addMessageIdCandidates(message, candidates);

  try {
    const contact = await message.getContact();
    addContactIdCandidates(contact, candidates);
  } catch (error) {
    // Em alguns contextos o WhatsApp pode falhar ao buscar contato.
    // A verificação continua usando os IDs já presentes na mensagem.
  }

  return candidates;
}

async function isAdmin(message) {
  const configuredAdmins = getConfiguredAdminIds();
  if (configuredAdmins.size === 0) return false;

  const senderCandidates = await getSenderAdminCandidates(message);
  for (const candidate of senderCandidates) {
    if (configuredAdmins.has(candidate)) return true;
  }

  return false;
}

module.exports = {
  isAdmin,
  normalizeIdentifier,
  onlyDigits,
  buildComparableIds,
  getSenderAdminCandidates,
  getConfiguredAdminIds,
};
