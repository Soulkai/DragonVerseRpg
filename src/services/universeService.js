const db = require('../database/db');
const { isAdmin } = require('../utils/admin');
const { parseInteger } = require('../utils/numbers');
const { createUniverseWithCharacters } = require('../database/migrate');
const { getOrCreatePlayerFromMessage } = require('./playerService');

function canCreateUniverse(message) {
  if (isAdmin(message)) return true;
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  return ['A.S', 'S.M'].includes(player.cargo_id);
}

function addUniverso(message, argsText) {
  if (!canCreateUniverse(message)) {
    return { ok: false, message: 'Apenas administradores, Autoridade Suprema ou Supremo Ministro podem criar universos.' };
  }

  const universeId = parseInteger(argsText.split(/\s+/)[0]);
  if (!universeId || universeId <= 0) {
    return { ok: false, message: 'Use assim: */adduniverso número*\nExemplo: */adduniverso 3*' };
  }

  const exists = db.prepare('SELECT id FROM universes WHERE id = ?').get(universeId);
  if (exists) {
    return { ok: false, message: `O Universo ${universeId} já existe.` };
  }

  const result = createUniverseWithCharacters(universeId, `Universo ${universeId}`, null, true);
  if (!result.ok) return result;

  return {
    ok: true,
    message: [
      '✅ *Novo universo criado!*',
      '',
      `🌌 Universo: *${universeId}*`,
      '📜 Lista de personagens criada limpa, sem ocupados.',
      '🔒 Personagens lendários continuam bloqueados por código de resgate.',
      '',
      `Use */Personagens ${universeId}* para ver a lista.`,
    ].join('\n'),
  };
}

module.exports = { addUniverso };
