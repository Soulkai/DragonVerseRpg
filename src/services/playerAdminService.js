const db = require('../database/db');
const { isAdmin } = require('../utils/admin');
const { parseInteger } = require('../utils/numbers');
const { mentionPlayer, mentionIds } = require('../utils/mentions');
const { getWhatsAppIdFromMessage, getPlayerByWhatsAppId } = require('./playerService');
const { removePlayerFromCardGames } = require('./cardGameService');

function listPlayers() {
  return db.prepare(`
    SELECT
      p.id,
      p.whatsapp_id,
      p.phone,
      p.display_name,
      p.ki_atual,
      p.zenies,
      p.cargo_id,
      p.cargo,
      p.created_at,
      cc.universe_id,
      cc.claim_type,
      c.name AS character_name
    FROM players p
    LEFT JOIN character_claims cc ON cc.player_id = p.id
    LEFT JOIN characters c ON c.id = cc.character_id
    ORDER BY p.id ASC
  `).all();
}

async function canDeletePlayer(message) {
  if (await isAdmin(message)) return true;

  // Segurança extra: este comando é destrutivo, mas permite Alta Cúpula caso o bot esteja sendo administrado dentro do RPG.
  const senderId = getWhatsAppIdFromMessage(message);
  const sender = senderId ? getPlayerByWhatsAppId(senderId) : null;
  const role = String(sender?.cargo_id || '').toUpperCase();
  return ['A.S', 'S.M'].includes(role);
}

function formatUniverse(row) {
  return row?.universe_id ? `U${row.universe_id}` : 'U?';
}

function formatPlayersList(rows = []) {
  if (!rows.length) {
    return '🐉 *DragonVerse — Players cadastrados*\n\nNenhum player cadastrado ainda.';
  }

  return [
    '╭━━⪩ 🐉 *PLAYERS DRAGONVERSE* ⪨━━',
    '▢',
    ...rows.map((row, index) => {
      const character = row.character_name ? ` — ${row.character_name}` : '';
      return `▢ ${index + 1} - ${mentionPlayer(row)} - ${formatUniverse(row)}${character}`;
    }),
    '▢',
    `▢ • Total: *${rows.length}* player(s).`,
    '╰━━─「🐉」─━━',
  ].join('\n');
}

function deletePlayerEverywhere(playerId) {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  if (!player) return null;

  const cardGames = typeof removePlayerFromCardGames === 'function'
    ? removePlayerFromCardGames(player.id)
    : { blackjack: 0, poker: 0, truco: 0 };

  const deleted = {};
  const runDelete = (name, sql, ...params) => {
    const result = db.prepare(sql).run(...params);
    deleted[name] = result.changes || 0;
    return result;
  };

  const transaction = db.transaction(() => {
    // Códigos e registros sem FK direta no player.
    runDelete('rescue_codes_redeemed', 'DELETE FROM rescue_codes WHERE redeemed_by = ?', player.whatsapp_id);
    runDelete('rescue_codes_created', 'DELETE FROM rescue_codes WHERE created_by = ?', player.whatsapp_id);

    // Relações diretas do player.
    runDelete('active_events_claimed', 'DELETE FROM active_events WHERE claimed_by_player_id = ?', player.id);
    runDelete('active_events_player', 'DELETE FROM active_events WHERE player_id = ?', player.id);
    runDelete('event_daily_stats', 'DELETE FROM event_daily_stats WHERE player_id = ?', player.id);
    runDelete('event_streaks', 'DELETE FROM event_streaks WHERE player_id = ?', player.id);

    runDelete('transfer_history_from', 'DELETE FROM transfer_history WHERE from_player_id = ?', player.id);
    runDelete('transfer_history_to', 'DELETE FROM transfer_history WHERE to_player_id = ?', player.id);
    runDelete('economy_ledger_player', 'DELETE FROM economy_ledger WHERE player_id = ?', player.id);
    db.prepare('UPDATE economy_ledger SET related_player_id = NULL WHERE related_player_id = ?').run(player.id);

    runDelete('player_inventory', 'DELETE FROM player_inventory WHERE player_id = ?', player.id);
    runDelete('purchase_history', 'DELETE FROM purchase_history WHERE player_id = ?', player.id);
    runDelete('player_discounts', 'DELETE FROM player_discounts WHERE player_id = ?', player.id);

    runDelete('referral_codes', 'DELETE FROM referral_codes WHERE player_id = ?', player.id);
    runDelete('player_referrals_recruit', 'DELETE FROM player_referrals WHERE recruit_id = ?', player.id);
    runDelete('player_referrals_recruiter', 'DELETE FROM player_referrals WHERE recruiter_id = ?', player.id);

    runDelete('generic_code_redemptions', 'DELETE FROM generic_code_redemptions WHERE player_id = ?', player.id);
    runDelete('box_openings', 'DELETE FROM box_openings WHERE player_id = ?', player.id);
    runDelete('player_collectibles', 'DELETE FROM player_collectibles WHERE player_id = ?', player.id);

    // Rankeada / Z Market.
    runDelete('ranked_fights_challenger', 'DELETE FROM ranked_fights WHERE challenger_id = ?', player.id);
    runDelete('ranked_fights_challenged', 'DELETE FROM ranked_fights WHERE challenged_id = ?', player.id);
    db.prepare('UPDATE ranked_fights SET winner_id = NULL WHERE winner_id = ?').run(player.id);
    runDelete('ranked_profiles', 'DELETE FROM ranked_profiles WHERE player_id = ?', player.id);
    runDelete('zmarket_purchases', 'DELETE FROM zmarket_purchases WHERE player_id = ?', player.id);

    // Torneios.
    runDelete('tournament_entries', 'DELETE FROM tournament_entries WHERE player_id = ?', player.id);
    runDelete('tournament_matches_p1', 'DELETE FROM tournament_matches WHERE player1_id = ?', player.id);
    runDelete('tournament_matches_p2', 'DELETE FROM tournament_matches WHERE player2_id = ?', player.id);
    db.prepare('UPDATE tournament_matches SET winner_player_id = NULL WHERE winner_player_id = ?').run(player.id);
    db.prepare('UPDATE tournaments SET winner_player_id = NULL WHERE winner_player_id = ?').run(player.id);

    // Caça-cabeça.
    runDelete('bounty_results_winner', 'DELETE FROM bounty_results WHERE winner_player_id = ?', player.id);
    runDelete('bounty_events_target', 'DELETE FROM bounty_events WHERE target_player_id = ?', player.id);

    // Personagem e conta.
    runDelete('character_claims', 'DELETE FROM character_claims WHERE player_id = ?', player.id);
    runDelete('players', 'DELETE FROM players WHERE id = ?', player.id);
  });

  transaction();
  return { player, deleted, cardGames };
}

async function playersListCommand(message, command = null, client = null) {
  const rows = listPlayers();
  const result = {
    ok: true,
    message: formatPlayersList(rows),
    mentions: mentionIds(rows),
  };

  if (client && result.mentions.length) {
    await client.sendMessage(message.from, result.message, { mentions: result.mentions });
    return;
  }

  await message.reply(result.message);
}

async function deletePlayerCommand(message, command, client) {
  if (!(await canDeletePlayer(message))) {
    await message.reply('Apenas ADM ou Autoridade Suprema/Supremo Ministro pode usar */deleteplayer*.' );
    return;
  }

  const number = parseInteger(command.argsText);
  if (!number || number < 1) {
    await message.reply('Use assim: */deleteplayer número*\n\nExemplo: */deleteplayer 3*\nO número é o mesmo mostrado em */players*.');
    return;
  }

  const rows = listPlayers();
  const target = rows[number - 1];
  if (!target) {
    await message.reply(`Não existe player número *${number}* na lista atual. Use */players* para conferir.`);
    return;
  }

  const result = deletePlayerEverywhere(target.id);
  if (!result) {
    await message.reply('Não consegui encontrar esse player no banco de dados. Use */players* novamente.');
    return;
  }

  const deletedRows = Object.values(result.deleted).reduce((sum, value) => sum + Number(value || 0), 0);
  const cardGamesClosed = Number(result.cardGames.blackjack || 0) + Number(result.cardGames.poker || 0) + Number(result.cardGames.truco || 0);

  const response = [
    '╭━━⪩ 🗑️ *PLAYER DELETADO* ⪨━━',
    '▢',
    `▢ • Número da lista: *${number}*`,
    `▢ • Player: ${mentionPlayer(target)}`,
    `▢ • Universo: *${formatUniverse(target)}*`,
    target.character_name ? `▢ • Personagem liberado: *${target.character_name}*` : null,
    '▢',
    '▢ • Foram removidos:',
    '▢   ⤷ Conta do player',
    '▢   ⤷ Zenies e poupança',
    '▢   ⤷ Personagem ocupado',
    '▢   ⤷ Inventário e compras',
    '▢   ⤷ Eventos e streaks',
    '▢   ⤷ Convites e bônus',
    '▢   ⤷ Codes resgatados',
    '▢   ⤷ Caixas e colecionáveis',
    '▢   ⤷ Participações em torneios e rankeadas',
    '▢   ⤷ Registros de caça-cabeça',
    `▢   ⤷ Jogos de cartas ativos fechados: *${cardGamesClosed}*`,
    '▢',
    `▢ • Registros SQL afetados: *${deletedRows}*`,
    '╰━━─「🗑️」─━━',
  ].filter(Boolean).join('\n');

  if (client) {
    await client.sendMessage(message.from, response, { mentions: mentionIds(target) });
    return;
  }

  await message.reply(response);
}

module.exports = {
  listPlayers,
  playersListCommand,
  deletePlayerCommand,
  deletePlayerEverywhere,
};
