const db = require('../database/db');
const { STARTING_ZENIES, calculateTotalSalary } = require('../data/roles');

function getWhatsAppIdFromMessage(message) {
  return message.author || message.from;
}

function phoneFromWhatsAppId(whatsappId = '') {
  return String(whatsappId).split('@')[0].replace(/\D/g, '');
}

function getDisplayNameFromMessage(message) {
  return message._data?.notifyName || message._data?.pushName || null;
}

function getOrCreatePlayerFromMessage(message, { touch = true } = {}) {
  const whatsappId = getWhatsAppIdFromMessage(message);
  const displayName = getDisplayNameFromMessage(message);
  return getOrCreatePlayerByWhatsAppId(whatsappId, displayName, { touch });
}

function getOrCreatePlayerByWhatsAppId(whatsappId, displayName = null, { touch = false } = {}) {
  if (!whatsappId) throw new Error('whatsappId é obrigatório para criar jogador.');

  const phone = phoneFromWhatsAppId(whatsappId);
  const salary = calculateTotalSalary('L.I');

  db.prepare(`
    INSERT INTO players (
      whatsapp_id,
      phone,
      display_name,
      ki_atual,
      zenies,
      deposito,
      cargo_id,
      cargo,
      trabalho_id,
      trabalho,
      salario,
      last_active_at,
      last_salary_at,
      last_deposit_interest_at
    )
    VALUES (?, ?, ?, 1, ?, 0, 'L.I', 'Lutador Iniciante', NULL, 'Nenhum', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(whatsapp_id) DO UPDATE SET
      phone = excluded.phone,
      display_name = COALESCE(excluded.display_name, players.display_name),
      last_active_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE players.last_active_at END,
      updated_at = CURRENT_TIMESTAMP
  `).run(whatsappId, phone, displayName, STARTING_ZENIES, salary, touch ? 1 : 0);

  return getPlayerByWhatsAppId(whatsappId);
}

function getPlayerByWhatsAppId(whatsappId) {
  return db.prepare('SELECT * FROM players WHERE whatsapp_id = ?').get(whatsappId);
}

function touchPlayerActivity(message) {
  const whatsappId = getWhatsAppIdFromMessage(message);
  if (!whatsappId) return null;

  const existing = getPlayerByWhatsAppId(whatsappId);
  if (!existing) return null;

  db.prepare(`
    UPDATE players
    SET last_active_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE whatsapp_id = ?
  `).run(whatsappId);

  return getPlayerByWhatsAppId(whatsappId);
}

function getPlayerClaim(playerId) {
  return db.prepare(`
    SELECT
      cc.*,
      c.name AS character_name,
      c.slug AS character_slug,
      c.image_path,
      u.name AS universe_name
    FROM character_claims cc
    JOIN characters c ON c.id = cc.character_id
    JOIN universes u ON u.id = cc.universe_id
    WHERE cc.player_id = ?
  `).get(playerId);
}

module.exports = {
  getWhatsAppIdFromMessage,
  phoneFromWhatsAppId,
  getOrCreatePlayerFromMessage,
  getOrCreatePlayerByWhatsAppId,
  getPlayerByWhatsAppId,
  touchPlayerActivity,
  getPlayerClaim,
};
