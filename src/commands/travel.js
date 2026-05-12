const db = require('../database/db');
const { money } = require('../utils/format');
const { parseAmount } = require('../utils/numbers');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');
const { normalizeText } = require('../utils/text');

const TRAVEL_COST = 50_000_000;
const TRAVEL_DURATION_MS = 24 * 60 * 60 * 1000;

function ensureTables() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS universe_links (
      universe_id INTEGER PRIMARY KEY,
      chat_id TEXT NOT NULL UNIQUE,
      chat_name TEXT,
      linked_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS player_travel_state (
      player_id INTEGER PRIMARY KEY,
      origin_universe INTEGER NOT NULL,
      origin_chat_id TEXT NOT NULL,
      target_universe INTEGER NOT NULL,
      target_chat_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS muted_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      muted_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS blocked_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      command TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chat_id, command)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS command_aliases (
      alias TEXT PRIMARY KEY,
      targets TEXT NOT NULL
    )
  `).run();

  const insertAlias = db.prepare(`INSERT OR IGNORE INTO command_aliases (alias, targets) VALUES (?, ?)`);
  insertAlias.run('cartas', JSON.stringify(['blackjack', 'bj', 'poker', 'truco', 'ltruco', 'cards']));
  insertAlias.run('jogosdecartas', JSON.stringify(['blackjack', 'bj', 'poker', 'truco', 'ltruco']));
}

ensureTables();

function normalizeCommand(value) {
  return normalizeText(String(value || '').trim());
}

function parseUniverseArg(command) {
  const raw = command?.args?.[0];
  const n = Number(String(raw || '').replace(/\D/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getGroupChatId(message) {
  return message.from?.endsWith('@g.us') ? message.from : null;
}

function getUserJid(message) {
  return message.author || message.from;
}

function getPlayer(message) {
  return getOrCreatePlayerFromMessage(message, { touch: true });
}

function getLinkedUniverseByChat(chatId) {
  return db.prepare(`SELECT * FROM universe_links WHERE chat_id = ?`).get(chatId);
}

function getLinkedChatByUniverse(universeId) {
  return db.prepare(`SELECT * FROM universe_links WHERE universe_id = ?`).get(universeId);
}

function isCommandBlocked(chatId, commandName) {
  const normalized = normalizeCommand(commandName);
  const blocks = db.prepare(`SELECT command FROM blocked_commands WHERE chat_id = ?`).all(chatId);
  if (!blocks.length) return false;

  const aliasRow = db.prepare(`SELECT targets FROM command_aliases WHERE alias = ?`).get(normalized);
  const aliasTargets = aliasRow ? JSON.parse(aliasRow.targets || '[]').map(normalizeCommand) : [];
  const blocked = new Set(blocks.map((row) => normalizeCommand(row.command)));

  if (blocked.has(normalized)) return true;
  for (const target of aliasTargets) if (blocked.has(target)) return true;

  if (blocked.has('cartas') && ['blackjack', 'bj', 'poker', 'truco', 'ltruco', 'cards'].includes(normalized)) return true;
  if (blocked.has('jogosdecartas') && ['blackjack', 'bj', 'poker', 'truco', 'ltruco'].includes(normalized)) return true;

  return false;
}

function getMutedRecord(chatId, userId) {
  return db.prepare(`
    SELECT * FROM muted_users
    WHERE chat_id = ? AND user_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(chatId, userId);
}

function isMuted(chatId, userId) {
  const row = getMutedRecord(chatId, userId);
  if (!row) return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

function clearExpiredMutes() {
  db.prepare(`
    DELETE FROM muted_users
    WHERE expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')
  `).run();
}

function parseDurationToMs(text) {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return null;
  const match = raw.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  const map = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * map[unit];
}

async function travelAdminCommand(message, command) {
  const groupChatId = getGroupChatId(message);
  if (!groupChatId) return message.reply('Esse comando só pode ser usado em grupo.');

  const universeId = parseUniverseArg(command);
  if (!universeId) return message.reply('Use assim: */linkar <numero_do_universo>*');

  const chat = await message.getChat();
  db.prepare(`
    INSERT OR REPLACE INTO universe_links (universe_id, chat_id, chat_name, linked_by, created_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(universeId, groupChatId, chat?.name || null, message.author || message.from);

  return message.reply(`🌌 Universo *${universeId}* linkado neste grupo com sucesso.`);
}

async function moveParticipantBetweenChats(client, participantJid, fromChatId, toChatId) {
  const fromChat = await client.getChatById(fromChatId);
  const toChat = await client.getChatById(toChatId);

  if (!fromChat || !toChat) throw new Error('Não foi possível localizar um dos grupos vinculados.');

  try {
    if (typeof fromChat.removeParticipants === 'function') {
      await fromChat.removeParticipants([participantJid]);
    }
  } catch (error) {
    console.error('[travel] removeParticipants failed:', error?.message || error);
  }

  try {
    if (typeof toChat.addParticipants === 'function') {
      await toChat.addParticipants([participantJid]);
    }
  } catch (error) {
    console.error('[travel] addParticipants failed:', error?.message || error);
    throw error;
  }
}

async function travelCommand(message, command, client) {
  const groupChatId = getGroupChatId(message);
  if (!groupChatId) return message.reply('Esse comando só pode ser usado em grupo.');

  const targetUniverseId = parseUniverseArg(command);
  if (!targetUniverseId) return message.reply('Use assim: */viajar <numero_do_universo>*');

  const player = getPlayer(message);
  const userJid = getUserJid(message);
  const originLink = getLinkedUniverseByChat(groupChatId);
  if (!originLink) return message.reply('Este grupo ainda não está linkado a um universo. Use */linkar <numero>*.');

  if (String(originLink.universe_id) === String(targetUniverseId)) {
    return message.reply('Você já está nesse universo.');
  }

  const targetLink = getLinkedChatByUniverse(targetUniverseId);
  if (!targetLink) {
    return message.reply(`O Universo *${targetUniverseId}* ainda não foi linkado por um ADM.`);
  }

  if (Number(player.zenies || 0) < TRAVEL_COST) {
    return message.reply(`❌ Você precisa de *${money(TRAVEL_COST)} Zenies* para viajar.`);
  }

  const activeTravel = db.prepare(`
    SELECT * FROM player_travel_state
    WHERE player_id = ? AND active = 1
  `).get(player.id);
  if (activeTravel) return message.reply('Você já está em viagem ativa.');

  db.prepare(`
    UPDATE players
    SET zenies = zenies - ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(TRAVEL_COST, player.id);

  const now = new Date();
  const endsAt = new Date(Date.now() + TRAVEL_DURATION_MS);
  db.prepare(`
    INSERT INTO player_travel_state (
      player_id, origin_universe, origin_chat_id, target_universe, target_chat_id,
      started_at, ends_at, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(player.id, originLink.universe_id, originLink.chat_id, targetUniverseId, targetLink.chat_id, now.toISOString(), endsAt.toISOString());

  db.prepare(`
    UPDATE players
    SET universe = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(targetUniverseId, player.id);

  try {
    await moveParticipantBetweenChats(client, userJid, originLink.chat_id, targetLink.chat_id);
  } catch (error) {
    db.prepare(`
      UPDATE players
      SET zenies = zenies + ?, universe = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(TRAVEL_COST, originLink.universe_id, player.id);
    db.prepare(`DELETE FROM player_travel_state WHERE player_id = ?`).run(player.id);
    return message.reply('❌ Não consegui mover você entre os grupos. Verifique se o bot é admin e se o WhatsApp permite adicionar participantes.');
  }

  return message.reply([
    '🌌 *Viagem iniciada!*',
    '',
    `• De: Universo *${originLink.universe_id}*`,
    `• Para: Universo *${targetUniverseId}*`,
    `• Custo: *${money(TRAVEL_COST)} Zenies*`,
    `• Retorno automático em *24 horas*`,
  ].join('\n'));
}

async function processTravelReturns(client) {
  clearExpiredMutes();

  const dueTravels = db.prepare(`
    SELECT * FROM player_travel_state
    WHERE active = 1 AND datetime(ends_at) <= datetime('now')
    ORDER BY id ASC
  `).all();

  for (const travel of dueTravels) {
    try {
      const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(travel.player_id);
      if (!player) {
        db.prepare(`UPDATE player_travel_state SET active = 0 WHERE id = ?`).run(travel.id);
        continue;
      }

      const participantJid = player.whatsapp_id || player.phone || player.jid;
      if (participantJid && client?.getChatById) {
        const fromChat = await client.getChatById(travel.target_chat_id);
        const toChat = await client.getChatById(travel.origin_chat_id);

        try {
          if (fromChat && typeof fromChat.removeParticipants === 'function') {
            await fromChat.removeParticipants([participantJid]);
          }
        } catch (error) {
          console.error('[travel return] removeParticipants failed:', error?.message || error);
        }

        try {
          if (toChat && typeof toChat.addParticipants === 'function') {
            await toChat.addParticipants([participantJid]);
          }
        } catch (error) {
          console.error('[travel return] addParticipants failed:', error?.message || error);
        }
      }

      db.prepare(`
        UPDATE players
        SET universe = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(travel.origin_universe, travel.player_id);

      db.prepare(`UPDATE player_travel_state SET active = 0 WHERE id = ?`).run(travel.id);

      if (client?.sendMessage) {
        try {
          await client.sendMessage(
            travel.origin_chat_id,
            `🌌 @${player.phone || player.whatsapp_id} retornou ao Universo *${travel.origin_universe}* após a viagem.`,
            { mentions: [player.whatsapp_id || player.phone].filter(Boolean) }
          );
        } catch {}
      }
    } catch (error) {
      console.error('[travel] return processing failed:', error?.message || error);
    }
  }
}

async function muteCommand(message, command) {
  const groupChatId = getGroupChatId(message);
  if (!groupChatId) return message.reply('Esse comando só pode ser usado em grupo.');

  const userJid = message.mentionedIds?.[0] || null;
  if (!userJid) return message.reply('Marque a pessoa para mutar. Ex.: */mute @pessoa*');

  const durationArg = command?.args?.[1];
  const expiresMs = parseDurationToMs(durationArg);
  const expiresAt = expiresMs ? new Date(Date.now() + expiresMs).toISOString() : null;

  db.prepare(`
    INSERT INTO muted_users (chat_id, user_id, muted_by, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(groupChatId, userJid, message.author || message.from, expiresAt);

  return message.reply(expiresAt ? `🔇 Usuário mutado até ${new Date(expiresAt).toLocaleString('pt-BR')}.` : '🔇 Usuário mutado sem prazo.');
}

async function unmuteCommand(message) {
  const groupChatId = getGroupChatId(message);
  if (!groupChatId) return message.reply('Esse comando só pode ser usado em grupo.');

  const userJid = message.mentionedIds?.[0] || null;
  if (!userJid) return message.reply('Marque a pessoa para desmutar. Ex.: */unmute @pessoa*');

  db.prepare(`
    DELETE FROM muted_users
    WHERE chat_id = ? AND user_id = ?
  `).run(groupChatId, userJid);

  return message.reply('🔊 Usuário desmutado.');
}

function normalizeBlockCommandArg(commandArg = '') {
  return normalizeCommand(commandArg).replace(/\s+/g, '');
}

async function blockCmdCommand(message, command) {
  const groupChatId = getGroupChatId(message);
  if (!groupChatId) return message.reply('Esse comando só pode ser usado em grupo.');

  const cmd = normalizeBlockCommandArg(command?.args?.[0]);
  if (!cmd) return message.reply('Use assim: */blockcmd cartas* ou */blockcmd poker*');

  db.prepare(`
    INSERT OR IGNORE INTO blocked_commands (chat_id, command)
    VALUES (?, ?)
  `).run(groupChatId, cmd);

  return message.reply(`🚫 Comando/categoria */${cmd}* bloqueado neste grupo.`);
}

async function unblockCmdCommand(message, command) {
  const groupChatId = getGroupChatId(message);
  if (!groupChatId) return message.reply('Esse comando só pode ser usado em grupo.');

  const cmd = normalizeBlockCommandArg(command?.args?.[0]);
  if (!cmd) return message.reply('Use assim: */unblockcmd cartas* ou */unblockcmd poker*');

  db.prepare(`
    DELETE FROM blocked_commands
    WHERE chat_id = ? AND command = ?
  `).run(groupChatId, cmd);

  return message.reply(`✅ Comando/categoria */${cmd}* liberado.`);
}

module.exports = {
  TRAVEL_COST,
  ensureTables,
  travelAdminCommand,
  travelCommand,
  processTravelReturns,
  muteCommand,
  unmuteCommand,
  blockCmdCommand,
  unblockCmdCommand,
  isMuted,
  isCommandBlocked,
  getGroupChatId,
  getUserJid,
};
