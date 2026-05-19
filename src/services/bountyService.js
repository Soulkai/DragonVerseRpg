const db = require('../database/db');
const settings = require('../config/settings');
const { isAdmin } = require('../utils/admin');
const { getFirstMentionedId } = require('../utils/mentions');
const { money } = require('../utils/format');
const { getOrCreatePlayerFromMessage, getOrCreatePlayerByWhatsAppId, getWhatsAppIdFromMessage } = require('./playerService');
const { grantZenies } = require('./rewardService');
const { localDateKey } = require('./streakService');
const { mentionPlayer, mentionIds } = require('../utils/mentions');

const TARGET_WIN_REWARD = 50_000_000;
const HUNTER_BASE_REWARD = 200_000_000;
const HUNTER_KI_MULTIPLIER = 50_000_000;

function getActiveBounty(chatId) {
  return db.prepare(`
    SELECT b.*, p.whatsapp_id, p.phone, p.ki_atual, p.display_name
    FROM bounty_events b
    JOIN players p ON p.id = b.target_player_id
    WHERE b.chat_id = ? AND b.status = 'active'
    ORDER BY b.created_at DESC
    LIMIT 1
  `).get(chatId);
}

function randomTarget(universeId = settings.defaultUniverse) {
  const rows = db.prepare(`
    SELECT p.*, c.name AS character_name
    FROM character_claims cc
    JOIN players p ON p.id = cc.player_id
    JOIN characters c ON c.id = cc.character_id
    WHERE cc.universe_id = ?
      AND cc.claim_type = 'player'
    ORDER BY RANDOM()
    LIMIT 1
  `).all(universeId);
  return rows[0] || null;
}

function createDailyBountyForChat(chatId, universeId = settings.defaultUniverse) {
  const key = localDateKey();
  const existing = db.prepare('SELECT * FROM bounty_events WHERE chat_id = ? AND date_key = ?').get(chatId, key);
  if (existing) return null;

  db.prepare(`
    UPDATE bounty_events
    SET status = 'expired', ended_at = CURRENT_TIMESTAMP
    WHERE chat_id = ? AND status = 'active'
  `).run(chatId);

  const target = randomTarget(universeId);
  if (!target) return null;

  const result = db.prepare(`
    INSERT INTO bounty_events (chat_id, universe_id, target_player_id, target_character_name, date_key)
    VALUES (?, ?, ?, ?, ?)
  `).run(chatId, universeId, target.id, target.character_name, key);

  return {
    id: result.lastInsertRowid,
    chat_id: chatId,
    universe_id: universeId,
    target_player_id: target.id,
    target_character_name: target.character_name,
    date_key: key,
    status: 'active',
    ...target,
  };
}

function hunterRewardForTarget(target) {
  const ki = Number(target.ki_atual || 1);
  return Math.max(HUNTER_BASE_REWARD, ki * HUNTER_KI_MULTIPLIER);
}

async function requireBountyAdmin(message) {
  if (await isAdmin(message)) return { ok: true };
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  if (['A.S', 'S.M', 'HAKAI', 'ANJO', 'G.K'].includes(player.cargo_id)) return { ok: true };
  return { ok: false, message: 'Apenas admin ou Alta Cúpula pode confirmar vitória de caça-cabeça.' };
}

function formatBounty(bounty) {
  const reward = hunterRewardForTarget(bounty);
  return {
    ok: true,
    message: [
      '╭━━⪩ 🎯 *CAÇA-CABEÇA DRAGONVERSE* ⪨━━',
      '▢',
      `▢ • Universo: *${bounty.universe_id}*`,
      `▢ • Alvo: ${mentionPlayer(bounty)}`,
      `▢ • Personagem: *${bounty.target_character_name || 'Desconhecido'}*`,
      `▢ • Ki da Caça: *${bounty.ki_atual || 1}*`,
      '▢',
      `▢ • Se a caça vencer: *${money(TARGET_WIN_REWARD)} Zenies* por vitória.`,
      `▢ • Se o caçador abater: *${money(reward)} Zenies*.`,
      '▢',
      '▢ • Admin confirma com:',
      '▢   */vitoria caça*',
      '▢   */vitoria caçador @pessoa*',
      '╰━━─「🎯」─━━',
    ].join('\n'),
    mentions: mentionIds(bounty),
  };
}

async function bountyStatus(message) {
  const active = getActiveBounty(message.from);
  if (!active) return { ok: false, message: 'Não há caça-cabeça ativa neste grupo agora.' };
  return formatBounty(active);
}

async function vitoriaCaca(message) {
  const permission = await requireBountyAdmin(message);
  if (!permission.ok) return permission;

  const bounty = getActiveBounty(message.from);
  if (!bounty) return { ok: false, message: 'Não há caça-cabeça ativa neste grupo.' };

  grantZenies(bounty.target_player_id, TARGET_WIN_REWARD, 'bounty_target_win');
  db.prepare(`
    UPDATE bounty_events
    SET target_wins = target_wins + 1
    WHERE id = ?
  `).run(bounty.id);

  db.prepare(`
    INSERT INTO bounty_results (bounty_id, winner_type, winner_player_id, reward, created_by)
    VALUES (?, 'caca', ?, ?, ?)
  `).run(bounty.id, bounty.target_player_id, TARGET_WIN_REWARD, getWhatsAppIdFromMessage(message));

  return {
    ok: true,
    message: [
      '✅ *Vitória da caça confirmada!*',
      '',
      `${mentionPlayer(bounty)} sobreviveu/v venceu e recebeu *${money(TARGET_WIN_REWARD)} Zenies*.`
    ].join('\n'),
    mentions: mentionIds(bounty),
  };
}

async function vitoriaCacador(message, argsText = '') {
  const permission = await requireBountyAdmin(message);
  if (!permission.ok) return permission;

  const bounty = getActiveBounty(message.from);
  if (!bounty) return { ok: false, message: 'Não há caça-cabeça ativa neste grupo.' };

  const hunterWhatsappId = getFirstMentionedId(message, argsText) || getWhatsAppIdFromMessage(message);
  const hunter = getOrCreatePlayerByWhatsAppId(hunterWhatsappId, null, { touch: false });
  const reward = hunterRewardForTarget(bounty);

  grantZenies(hunter.id, reward, 'bounty_hunter_win');
  db.prepare(`
    UPDATE bounty_events
    SET hunter_wins = hunter_wins + 1,
        status = 'finished',
        ended_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(bounty.id);

  db.prepare(`
    INSERT INTO bounty_results (bounty_id, winner_type, winner_player_id, reward, created_by)
    VALUES (?, 'cacador', ?, ?, ?)
  `).run(bounty.id, hunter.id, reward, getWhatsAppIdFromMessage(message));

  return {
    ok: true,
    message: [
      '💀 *Caça abatida!*',
      '',
      `Caçador: ${mentionPlayer(hunter)}`,
      `Alvo abatido: ${mentionPlayer(bounty)} — *${bounty.target_character_name || 'Desconhecido'}*`,
      `Prêmio do caçador: *${money(reward)} Zenies*`,
      '',
      'O evento de caça-cabeça foi encerrado.',
    ].join('\n'),
    mentions: mentionIds(hunter, bounty),
  };
}

async function vitoria(message, argsText = '') {
  const action = String(argsText || '').trim().split(/\s+/)[0]?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['caca', 'caça'].includes(action)) return vitoriaCaca(message);
  if (['cacador', 'caçador'].includes(action)) return vitoriaCacador(message, argsText);
  return { ok: false, message: 'Use: */vitoria caça* ou */vitoria caçador @pessoa*.' };
}

module.exports = {
  TARGET_WIN_REWARD,
  HUNTER_BASE_REWARD,
  HUNTER_KI_MULTIPLIER,
  getActiveBounty,
  createDailyBountyForChat,
  formatBounty,
  bountyStatus,
  vitoria,
};
