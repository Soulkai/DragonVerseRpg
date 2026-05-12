const db = require('../database/db');
const { isAdmin } = require('../utils/admin');
const { parseAmount, parseInteger } = require('../utils/numbers');
const { money } = require('../utils/format');
const { slugify, normalizeText } = require('../utils/text');
const { getFirstMentionedId, removeFirstMention, mentionPlayer, mentionIds } = require('../utils/mentions');
const {
  getOrCreatePlayerFromMessage,
  getOrCreatePlayerByWhatsAppId,
  getPlayerByWhatsAppId,
} = require('./playerService');
const { grantZenies } = require('./rewardService');
const { recordLedger } = require('./ledgerService');

function shuffle(items = []) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

async function canManageTournament(message) {
  if (await isAdmin(message)) return { ok: true };
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const role = String(player.cargo_id || '').toUpperCase();
  if (['A.S', 'S.M', 'HAKAI', 'ANJO', 'G.K'].includes(role)) return { ok: true };
  return { ok: false, message: 'Apenas ADM ou Alta Cúpula pode administrar torneios.' };
}

function parseTournamentNameArg(argsText = '') {
  const raw = String(argsText || '').trim();
  if (!raw) return '';

  const parts = raw.split(/\s+/).filter(Boolean);
  if (normalizeText(parts[0]) === 'torneio') parts.shift();
  return parts.join(' ').trim();
}

function parseCreateTournamentArgs(argsText = '') {
  const raw = String(argsText || '').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  const feeText = parts.pop();
  const entryFee = parseAmount(feeText);
  const name = parts.join(' ').trim();
  if (!name || !entryFee || entryFee <= 0) return null;
  return { name, slug: slugify(name), entryFee };
}

function getTournamentBySlug(chatId, slug, statuses = []) {
  const statusClause = statuses.length ? `AND status IN (${statuses.map(() => '?').join(',')})` : '';
  return db.prepare(`
    SELECT * FROM tournaments
    WHERE chat_id = ? AND slug = ? ${statusClause}
    ORDER BY id DESC
    LIMIT 1
  `).get(chatId, slug, ...statuses);
}

function getSingleTournament(chatId, name = '', statuses = ['open', 'playing']) {
  const slug = slugify(name);
  if (slug) {
    const bySlug = getTournamentBySlug(chatId, slug, statuses);
    if (bySlug) return { ok: true, tournament: bySlug };
    return { ok: false, message: `Não encontrei torneio chamado *${name}* neste grupo.` };
  }

  const statusClause = statuses.length ? `AND status IN (${statuses.map(() => '?').join(',')})` : '';
  const rows = db.prepare(`
    SELECT * FROM tournaments
    WHERE chat_id = ? ${statusClause}
    ORDER BY id DESC
  `).all(chatId, ...statuses);

  if (rows.length === 0) return { ok: false, message: 'Não existe torneio aberto/em andamento neste grupo.' };
  if (rows.length > 1) {
    return {
      ok: false,
      message: [
        'Existe mais de um torneio neste grupo. Informe o nome:',
        '',
        ...rows.slice(0, 8).map((item) => `• */inscrever ${item.name}* — ${item.status}`),
      ].join('\n'),
    };
  }

  return { ok: true, tournament: rows[0] };
}

function getPlayerById(playerId) {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
}

function getTournamentEntries(tournamentId) {
  return db.prepare(`
    SELECT te.*, p.whatsapp_id, p.phone, p.display_name, p.zenies, p.ki_atual
    FROM tournament_entries te
    JOIN players p ON p.id = te.player_id
    WHERE te.tournament_id = ? AND te.is_active = 1
    ORDER BY te.id ASC
  `).all(tournamentId);
}

function getRoundMatches(tournamentId, roundNumber) {
  return db.prepare(`
    SELECT
      tm.*,
      p1.whatsapp_id AS p1_whatsapp_id,
      p1.phone AS p1_phone,
      p1.display_name AS p1_display_name,
      p2.whatsapp_id AS p2_whatsapp_id,
      p2.phone AS p2_phone,
      p2.display_name AS p2_display_name,
      pw.whatsapp_id AS w_whatsapp_id,
      pw.phone AS w_phone,
      pw.display_name AS w_display_name
    FROM tournament_matches tm
    JOIN players p1 ON p1.id = tm.player1_id
    LEFT JOIN players p2 ON p2.id = tm.player2_id
    LEFT JOIN players pw ON pw.id = tm.winner_player_id
    WHERE tm.tournament_id = ? AND tm.round_number = ?
    ORDER BY tm.match_number ASC
  `).all(tournamentId, roundNumber);
}

function playerFromMatch(row, side) {
  if (side === 1) {
    return {
      id: row.player1_id,
      whatsapp_id: row.p1_whatsapp_id,
      phone: row.p1_phone,
      display_name: row.p1_display_name,
    };
  }
  if (!row.player2_id) return null;
  return {
    id: row.player2_id,
    whatsapp_id: row.p2_whatsapp_id,
    phone: row.p2_phone,
    display_name: row.p2_display_name,
  };
}

function winnerFromMatch(row) {
  if (!row.winner_player_id) return null;
  return {
    id: row.winner_player_id,
    whatsapp_id: row.w_whatsapp_id,
    phone: row.w_phone,
    display_name: row.w_display_name,
  };
}

function formatBracket(tournament) {
  const matches = getRoundMatches(tournament.id, tournament.current_round);
  const mentions = [];

  const lines = [
    `╭━━⪩ 🏆 *TORNEIO: ${tournament.name}* ⪨━━`,
    '▢',
    `▢ • Status: *${tournament.status}*`,
    `▢ • Inscrição: *${money(tournament.entry_fee)} Zenies*`,
    `▢ • Fase atual: *${tournament.current_round || 0}*`,
    '▢',
  ];

  if (!matches.length) {
    const entries = getTournamentEntries(tournament.id);
    lines.push(`▢ • Inscritos: *${entries.length}*`);
    for (const entry of entries) {
      lines.push(`▢   • ${mentionPlayer(entry)}`);
      mentions.push(entry.whatsapp_id);
    }
  } else {
    lines.push('▢ • Chave:');
    for (const match of matches) {
      const p1 = playerFromMatch(match, 1);
      const p2 = playerFromMatch(match, 2);
      const winner = winnerFromMatch(match);
      mentions.push(p1.whatsapp_id);
      if (p2) mentions.push(p2.whatsapp_id);
      if (winner) mentions.push(winner.whatsapp_id);
      const status = match.status === 'finished'
        ? `✅ vencedor: ${mentionPlayer(winner)}`
        : '⏳ aguardando resultado';
      lines.push(`▢   Luta ${match.match_number}: ${mentionPlayer(p1)} vs ${p2 ? mentionPlayer(p2) : '*BYE*'} — ${status}`);
    }
  }

  lines.push('▢', '╰━━─「🏆」─━━');
  return { message: lines.join('\n'), mentions: [...new Set(mentions.filter(Boolean))] };
}

function chooseByePlayer(players, previousRound) {
  const eligible = players.filter((player) => Number(player.last_bye_round || 0) !== Number(previousRound));
  const pool = eligible.length ? eligible : players;
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateRound(tournament, players, roundNumber) {
  const shuffled = shuffle(players);
  let byePlayer = null;

  if (shuffled.length % 2 === 1) {
    byePlayer = chooseByePlayer(shuffled, roundNumber - 1);
    const index = shuffled.findIndex((player) => player.player_id === byePlayer.player_id);
    shuffled.splice(index, 1);
  }

  const insertMatch = db.prepare(`
    INSERT INTO tournament_matches (
      tournament_id, round_number, match_number, player1_id, player2_id, winner_player_id, status, is_bye, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END)
  `);

  let matchNumber = 1;
  for (let index = 0; index < shuffled.length; index += 2) {
    insertMatch.run(
      tournament.id,
      roundNumber,
      matchNumber,
      shuffled[index].player_id,
      shuffled[index + 1].player_id,
      null,
      'pending',
      0,
      0
    );
    matchNumber += 1;
  }

  if (byePlayer) {
    insertMatch.run(
      tournament.id,
      roundNumber,
      matchNumber,
      byePlayer.player_id,
      null,
      byePlayer.player_id,
      'finished',
      1,
      1
    );

    db.prepare(`
      UPDATE tournament_entries
      SET last_bye_round = ?
      WHERE tournament_id = ? AND player_id = ?
    `).run(roundNumber, tournament.id, byePlayer.player_id);
  }

  db.prepare(`
    UPDATE tournaments
    SET status = 'playing', current_round = ?, started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
    WHERE id = ?
  `).run(roundNumber, tournament.id);
}

async function createTournament(message, argsText = '') {
  const permission = await canManageTournament(message);
  if (!permission.ok) return permission;

  const parsed = parseCreateTournamentArgs(argsText);
  if (!parsed) {
    return { ok: false, message: 'Use assim: */gerartorneio NomeTorneio ValorInscrição*\nExemplo: */gerartorneio Torneio do Poder 100kk*' };
  }

  const exists = getTournamentBySlug(message.from, parsed.slug, ['open', 'playing']);
  if (exists) return { ok: false, message: `Já existe um torneio aberto/em andamento chamado *${parsed.name}* neste grupo.` };

  db.prepare(`
    INSERT INTO tournaments (chat_id, name, slug, entry_fee, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(message.from, parsed.name, parsed.slug, parsed.entryFee, message.author || message.from);

  return {
    ok: true,
    message: [
      '🏆 *Torneio criado!*',
      '',
      `Nome: *${parsed.name}*`,
      `Inscrição: *${money(parsed.entryFee)} Zenies*`,
      '',
      `Players podem entrar com: */inscrever ${parsed.name}*`,
      'Quando estiver pronto, use: */torneio iniciar*',
    ].join('\n'),
  };
}

function registerTournament(message, argsText = '') {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const name = parseTournamentNameArg(argsText);
  const found = getSingleTournament(message.from, name, ['open']);
  if (!found.ok) return found;
  const tournament = found.tournament;

  const already = db.prepare('SELECT id FROM tournament_entries WHERE tournament_id = ? AND player_id = ?').get(tournament.id, player.id);
  if (already) return { ok: false, message: 'Você já está inscrito nesse torneio.' };

  const fresh = getPlayerByWhatsAppId(player.whatsapp_id);
  if (Number(fresh.zenies || 0) < tournament.entry_fee) {
    return { ok: false, message: `Saldo insuficiente. Inscrição: *${money(tournament.entry_fee)} Zenies*. Seu saldo: *${money(fresh.zenies)} Zenies*.` };
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE players
      SET zenies = zenies - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(tournament.entry_fee, player.id);

    db.prepare(`
      INSERT INTO tournament_entries (tournament_id, player_id, paid_amount)
      VALUES (?, ?, ?)
    `).run(tournament.id, player.id, tournament.entry_fee);

    recordLedger({
      playerId: player.id,
      direction: 'saida',
      category: 'torneio_inscricao',
      amount: tournament.entry_fee,
      description: `Inscrição no torneio ${tournament.name}`,
      metadata: { tournamentId: tournament.id, tournamentName: tournament.name },
    });
  });
  transaction();

  const count = db.prepare('SELECT COUNT(*) AS total FROM tournament_entries WHERE tournament_id = ?').get(tournament.id).total || 0;

  return {
    ok: true,
    message: [
      `✅ ${mentionPlayer(player)} se inscreveu no torneio *${tournament.name}*!`,
      `Inscrição paga: *${money(tournament.entry_fee)} Zenies*`,
      `Inscritos: *${count}*`,
    ].join('\n'),
    mentions: mentionIds(player),
  };
}

async function startTournament(message, argsText = '') {
  const permission = await canManageTournament(message);
  if (!permission.ok) return permission;

  const action = normalizeText(firstWord(argsText));
  const name = action === 'iniciar' ? restWords(argsText) : argsText;
  const found = getSingleTournament(message.from, name, ['open']);
  if (!found.ok) return found;
  const tournament = found.tournament;
  const entries = getTournamentEntries(tournament.id);
  if (entries.length < 2) return { ok: false, message: 'O torneio precisa de pelo menos 2 inscritos para iniciar.' };

  const transaction = db.transaction(() => {
    generateRound(tournament, entries, 1);
  });
  transaction();

  const updated = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournament.id);
  const bracket = formatBracket(updated);
  return {
    ok: true,
    message: ['🏆 *Torneio iniciado!*', '', bracket.message, '', 'Use */vencedor NúmeroDaLuta @pessoa* para avançar os vencedores.'].join('\n'),
    mentions: bracket.mentions,
  };
}

function firstWord(text = '') {
  return String(text || '').trim().split(/\s+/)[0] || '';
}

function restWords(text = '') {
  const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
  parts.shift();
  return parts.join(' ');
}

function maybeAdvanceTournament(tournament) {
  const matches = db.prepare(`
    SELECT * FROM tournament_matches
    WHERE tournament_id = ? AND round_number = ?
    ORDER BY match_number ASC
  `).all(tournament.id, tournament.current_round);

  if (!matches.length || matches.some((match) => match.status !== 'finished' || !match.winner_player_id)) {
    return { advanced: false, finished: false, tournament };
  }

  const winners = matches.map((match) => ({
    tournament_id: tournament.id,
    player_id: match.winner_player_id,
    last_bye_round: db.prepare(`
      SELECT last_bye_round FROM tournament_entries
      WHERE tournament_id = ? AND player_id = ?
    `).get(tournament.id, match.winner_player_id)?.last_bye_round || 0,
  }));

  if (winners.length === 1) {
    const winnerId = winners[0].player_id;
    const prizePool = db.prepare(`
      SELECT COALESCE(SUM(paid_amount), 0) AS total
      FROM tournament_entries
      WHERE tournament_id = ?
    `).get(tournament.id).total || 0;

    if (prizePool > 0) grantZenies(winnerId, prizePool, 'torneio');

    db.prepare(`
      UPDATE tournaments
      SET status = 'finished', winner_player_id = ?, finished_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(winnerId, tournament.id);

    const finished = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournament.id);
    return { advanced: false, finished: true, tournament: finished, prizePool };
  }

  const nextRound = Number(tournament.current_round || 0) + 1;
  generateRound(tournament, winners, nextRound);
  const updated = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournament.id);
  return { advanced: true, finished: false, tournament: updated };
}

async function reportWinner(message, argsText = '') {
  const permission = await canManageTournament(message);
  if (!permission.ok) return permission;

  const matchNumber = parseInteger(firstWord(argsText));
  const targetWhatsappId = getFirstMentionedId(message, argsText);
  if (!matchNumber || !targetWhatsappId) {
    return { ok: false, message: 'Use assim: */vencedor NúmeroDaLuta @pessoa*\nExemplo: */vencedor 2 @Goku*' };
  }

  const found = getSingleTournament(message.from, '', ['playing']);
  if (!found.ok) return found;
  const tournament = found.tournament;
  const target = getOrCreatePlayerByWhatsAppId(targetWhatsappId, null, { touch: false });

  const match = db.prepare(`
    SELECT * FROM tournament_matches
    WHERE tournament_id = ? AND round_number = ? AND match_number = ?
  `).get(tournament.id, tournament.current_round, matchNumber);

  if (!match) return { ok: false, message: `Não encontrei a luta *${matchNumber}* na fase atual.` };
  if (match.status === 'finished') return { ok: false, message: `A luta *${matchNumber}* já tem vencedor.` };
  if (![match.player1_id, match.player2_id].includes(target.id)) {
    return { ok: false, message: 'A pessoa marcada não pertence a essa luta.' };
  }

  db.prepare(`
    UPDATE tournament_matches
    SET winner_player_id = ?, status = 'finished', finished_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(target.id, match.id);

  const progress = maybeAdvanceTournament(tournament);
  const mentions = [target.whatsapp_id];
  const lines = [
    `✅ *Resultado registrado!*`,
    '',
    `Torneio: *${tournament.name}*`,
    `Luta: *${matchNumber}*`,
    `Vencedor: ${mentionPlayer(target)}`,
  ];

  if (progress.finished) {
    const winner = getPlayerById(progress.tournament.winner_player_id);
    if (winner) mentions.push(winner.whatsapp_id);
    lines.push('', '🏆 *TORNEIO ENCERRADO!*', `Campeão: ${mentionPlayer(winner)}`, `Prêmio total: *${money(progress.prizePool || 0)} Zenies*`);
  } else if (progress.advanced) {
    const bracket = formatBracket(progress.tournament);
    mentions.push(...bracket.mentions);
    lines.push('', '🔥 *Nova fase gerada!*', '', bracket.message);
  } else {
    const bracket = formatBracket(tournament);
    mentions.push(...bracket.mentions);
    lines.push('', 'Aguardando os outros resultados da fase.', '', bracket.message);
  }

  return { ok: true, message: lines.join('\n'), mentions: [...new Set(mentions.filter(Boolean))] };
}

function tournamentStatus(message, argsText = '') {
  const action = normalizeText(firstWord(argsText));
  const name = ['status', 'chave', 'ver'].includes(action) ? restWords(argsText) : argsText;
  const found = getSingleTournament(message.from, name, ['open', 'playing', 'finished']);
  if (!found.ok) return found;
  return { ok: true, ...formatBracket(found.tournament) };
}

module.exports = {
  createTournament,
  registerTournament,
  startTournament,
  reportWinner,
  tournamentStatus,
};
