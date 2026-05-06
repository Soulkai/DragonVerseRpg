const db = require('../database/db');
const { money } = require('../utils/format');
const { parseAmount } = require('../utils/numbers');
const { getFirstMentionedId, removeFirstMention, mentionPlayer, mentionIds } = require('../utils/mentions');
const { isAdmin } = require('../utils/admin');
const { isHighCouncilRoleId } = require('../data/roles');
const {
  getOrCreatePlayerFromMessage,
  getOrCreatePlayerByWhatsAppId,
  getPlayerByWhatsAppId,
  getPlayerClaim,
} = require('./playerService');

const MAX_DAILY_FIGHTS = 5;
const FREE_REFUSE_AFTER_FIGHTS = 2;
const PR_RANGE = 15;
const ACCEPT_HOURS = 5;
const FIGHT_HOURS = 24;
const WIN_COOLDOWN_HOURS = 1;
const LOSE_COOLDOWN_HOURS = 3;

function dateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Campo_Grande' });
}

function seasonKey() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit' });
  return fmt.format(now);
}

function ensureSeason() {
  const key = seasonKey();
  const state = db.prepare("SELECT value FROM system_settings WHERE key = 'ranked_season_key'").get();
  if (!state) {
    db.prepare("INSERT INTO system_settings (key, value) VALUES ('ranked_season_key', ?)").run(key);
    return;
  }
  if (state.value === key) return;

  db.transaction(() => {
    db.prepare('UPDATE ranked_profiles SET pr = CAST(pr / 2 AS INTEGER), updated_at = CURRENT_TIMESTAMP').run();
    db.prepare("UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'ranked_season_key'").run(key);
  })();
}

function rankedProfile(playerId) {
  return db.prepare('SELECT * FROM ranked_profiles WHERE player_id = ?').get(playerId);
}

function ensureRankedProfile(playerId) {
  db.prepare(`
    INSERT INTO ranked_profiles (player_id, pr, pc)
    VALUES (?, 0, 0)
    ON CONFLICT(player_id) DO NOTHING
  `).run(playerId);
  return rankedProfile(playerId);
}

function getRankedPlayer(playerId) {
  return db.prepare(`
    SELECT p.*, rp.pr, rp.pc, rp.wins, rp.losses, rp.wo_wins, rp.wo_losses
    FROM players p
    JOIN ranked_profiles rp ON rp.player_id = p.id
    WHERE p.id = ?
  `).get(playerId);
}

function getRankedByWhatsappId(whatsappId) {
  const p = getPlayerByWhatsAppId(whatsappId);
  if (!p) return null;
  return getRankedPlayer(p.id);
}

function eloForPr(pr = 0) {
  const value = Number(pr || 0);
  if (value >= 400) return 'Supremo Sacerdote';
  if (value >= 350) return 'Anjo';
  if (value >= 300) return 'Deus da Destruição';
  if (value >= 250) return 'Semi Deus';
  if (value >= 200) return 'Super Saiyajin';
  if (value >= 150) return 'Elite';
  if (value >= 50) return 'Guerreiro Z';
  return 'Iniciante';
}

function fightCountToday(playerId) {
  return db.prepare(`
    SELECT COUNT(*) AS total
    FROM ranked_fights
    WHERE status IN ('accepted', 'completed', 'wo_completed')
      AND date_key = ?
      AND (challenger_id = ? OR challenged_id = ?)
  `).get(dateKey(), playerId, playerId).total || 0;
}

function activeChallengeForPlayer(playerId) {
  return db.prepare(`
    SELECT * FROM ranked_fights
    WHERE status IN ('pending', 'accepted')
      AND (challenger_id = ? OR challenged_id = ?)
    ORDER BY id DESC
    LIMIT 1
  `).get(playerId, playerId);
}

function latestCompletedFight(playerId) {
  return db.prepare(`
    SELECT * FROM ranked_fights
    WHERE status IN ('completed', 'wo_completed')
      AND (challenger_id = ? OR challenged_id = ?)
    ORDER BY datetime(finished_at) DESC, id DESC
    LIMIT 1
  `).get(playerId, playerId);
}

function cooldownStatus(playerId) {
  const latest = latestCompletedFight(playerId);
  if (!latest || !latest.finished_at) return { blocked: false };

  const finished = new Date(`${latest.finished_at.replace(' ', 'T')}Z`).getTime();
  const isWinner = latest.winner_id === playerId;
  const hours = isWinner ? WIN_COOLDOWN_HOURS : LOSE_COOLDOWN_HOURS;
  const until = finished + hours * 60 * 60 * 1000;
  const now = Date.now();
  if (now >= until) return { blocked: false };

  return {
    blocked: true,
    winner: isWinner,
    until,
    message: `Você está em espera por ter ${isWinner ? 'vencido' : 'perdido'} uma luta. Libera em *${new Date(until).toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' })}*.`
  };
}

function hasNearbyOpponent(challengerProfile) {
  const nearby = db.prepare(`
    SELECT COUNT(*) AS total
    FROM ranked_profiles rp
    WHERE rp.player_id <> ?
      AND ABS(rp.pr - ?) <= ?
  `).get(challengerProfile.player_id, challengerProfile.pr, PR_RANGE).total || 0;
  return nearby > 0;
}

function challengeRangeAllowed(challengerProfile, challengedProfile) {
  const diff = Math.abs(Number(challengerProfile.pr || 0) - Number(challengedProfile.pr || 0));
  if (diff <= PR_RANGE) return { ok: true };

  const challengerLower = Number(challengerProfile.pr || 0) < Number(challengedProfile.pr || 0);
  if (challengerLower && !hasNearbyOpponent(challengerProfile)) {
    return { ok: true, exception: true };
  }

  return {
    ok: false,
    message: `Desafio inválido. A diferença de PR precisa ser de até *${PR_RANGE} pontos*. Exceção: se não houver nenhum oponente ativo dentro desse intervalo, apenas o jogador com MENOS PR pode desafiar alguém acima.`
  };
}

function ensureNoExpiredChallenges() {
  const now = db.prepare("SELECT CURRENT_TIMESTAMP AS now").get().now;
  const pending = db.prepare(`
    SELECT * FROM ranked_fights
    WHERE status = 'pending' AND datetime(accept_expires_at) <= datetime(?)
  `).all(now);

  const accepted = db.prepare(`
    SELECT * FROM ranked_fights
    WHERE status = 'accepted' AND datetime(fight_expires_at) <= datetime(?)
  `).all(now);

  for (const fight of pending) {
    applyWoVictory(fight, fight.challenger_id, fight.challenged_id, 'desafiado_nao_respondeu');
  }

  for (const fight of accepted) {
    db.transaction(() => {
      db.prepare(`
        UPDATE ranked_profiles
        SET pr = MAX(pr - 3, 0), wo_losses = wo_losses + 1, updated_at = CURRENT_TIMESTAMP
        WHERE player_id IN (?, ?)
      `).run(fight.challenger_id, fight.challenged_id);
      db.prepare(`
        UPDATE ranked_fights
        SET status = 'wo_completed', result_type = 'duplo_wo', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(fight.id);
    })();
  }
}

function calculateWinPoints(winnerBefore, loserBefore) {
  const diff = Number(loserBefore.pr || 0) - Number(winnerBefore.pr || 0);
  if (diff >= 10) return 5; // venceu alguém 10+ PR acima
  if (diff <= -10) return 1; // venceu alguém 10+ PR abaixo
  return 2;
}

function applyNormalVictory(fight, winnerId) {
  const loserId = fight.challenger_id === winnerId ? fight.challenged_id : fight.challenger_id;
  const winnerBefore = rankedProfile(winnerId);
  const loserBefore = rankedProfile(loserId);
  const winnerPoints = calculateWinPoints(winnerBefore, loserBefore);
  const loserPoints = 1;

  db.transaction(() => {
    db.prepare(`
      UPDATE ranked_profiles
      SET pr = pr + ?, pc = pc + ?, wins = wins + 1, updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(winnerPoints, winnerPoints, winnerId);
    db.prepare(`
      UPDATE ranked_profiles
      SET pr = pr + ?, pc = pc + ?, losses = losses + 1, updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(loserPoints, loserPoints, loserId);
    db.prepare(`
      UPDATE ranked_fights
      SET status = 'completed', winner_id = ?, result_type = 'normal', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(winnerId, fight.id);
  })();

  return { winnerPoints, loserPoints, loserId };
}

function applyWoVictory(fight, winnerId, loserId, resultType = 'wo') {
  db.transaction(() => {
    db.prepare(`
      UPDATE ranked_profiles
      SET pr = pr + 1, pc = pc + 1, wo_wins = wo_wins + 1, updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(winnerId);
    db.prepare(`
      UPDATE ranked_profiles
      SET pr = MAX(pr - 3, 0), wo_losses = wo_losses + 1, updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(loserId);
    db.prepare(`
      UPDATE ranked_fights
      SET status = 'wo_completed', winner_id = ?, result_type = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(winnerId, resultType, fight.id);
  })();
}

function rankedRules() {
  return {
    ok: true,
    message: [
      '╭━━⪩ ⚔️ *RANKEADA DRAGONVERSE* ⪨━━',
      '▢',
      '▢ • */iRank* — entra na lista rankeada.',
      '▢ • */listaRank* — mostra todos os inscritos.',
      '▢ • */desafio @pessoa* — desafia um jogador.',
      '▢ • */adesafio* — aceita o desafio recebido.',
      '▢ • */rdesafio* — recusa o desafio recebido.',
      '▢ • */RV ID @pessoa* — juiz/admin registra vencedor.',
      '▢',
      '▢ *Limites:*',
      `▢ • Máximo de *${MAX_DAILY_FIGHTS}* lutas por dia.`,
      '▢ • Vitória: espera de 1 hora para desafiar de novo.',
      '▢ • Derrota: espera de 3 horas para desafiar de novo.',
      '▢ • Com 2 lutas feitas no dia, pode recusar sem penalidade.',
      '▢ • Diferença máxima: 15 PR, com exceção para quem tem menos PR e não tem oponente próximo.',
      '▢',
      '▢ *Pontos:*',
      '▢ • Vitória normal: +2 PR / +2 PC.',
      '▢ • Vitória contra alguém 10+ PR acima: +5 PR / +5 PC.',
      '▢ • Vitória contra alguém 10+ PR abaixo: +1 PR / +1 PC.',
      '▢ • Derrota normal: +1 PR / +1 PC.',
      '▢ • Vitória por W.O: +1 PR / +1 PC.',
      '▢ • Derrota por W.O: -3 PR.',
      '▢',
      '▢ *Elos:*',
      '▢ • Iniciante — 0 PR',
      '▢ • Guerreiro Z — 50 PR',
      '▢ • Elite — 150 PR',
      '▢ • Super Saiyajin — 200 PR',
      '▢ • Semi Deus — 250 PR',
      '▢ • Deus da Destruição — 300 PR',
      '▢ • Anjo — 350 PR',
      '▢ • Supremo Sacerdote — 400+ PR',
      '▢',
      '▢ *Temporada:* todo dia 1 os PR são reduzidos em 50%. PC não reseta.',
      '╰━━─「⚔️」─━━',
    ].join('\n'),
  };
}

function joinRanked(message) {
  ensureSeason();
  ensureNoExpiredChallenges();
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const profile = ensureRankedProfile(player.id);
  return {
    ok: true,
    message: [
      '✅ *Inscrição rankeada ativa!*',
      '',
      `👤 Player: ${mentionPlayer(player)}`,
      `🏆 Elo: *${eloForPr(profile.pr)}*`,
      `⚔️ PR: *${profile.pr}*`,
      `🪙 PC: *${profile.pc}*`,
    ].join('\n'),
    mentions: [player.whatsapp_id],
  };
}

function listRanked() {
  ensureSeason();
  ensureNoExpiredChallenges();
  const rows = db.prepare(`
    SELECT p.*, rp.pr, rp.pc
    FROM ranked_profiles rp
    JOIN players p ON p.id = rp.player_id
    ORDER BY rp.pr DESC, rp.pc DESC, p.id ASC
  `).all();

  if (!rows.length) return { ok: true, message: 'Ainda não tem ninguém inscrito na rankeada. Use */iRank*.' };

  const lines = ['╭━━⪩ ⚔️ *LISTA RANKEADA* ⪨━━', '▢'];
  const mentions = [];
  rows.forEach((player, index) => {
    const claim = getPlayerClaim(player.id);
    mentions.push(player.whatsapp_id);
    lines.push(
      `▢ ${index + 1}. Player: ${mentionPlayer(player)}`,
      `▢    Personagem: *${claim?.character_name || 'Sem personagem'}*`,
      `▢    PR: *${player.pr}* | PC: *${player.pc}* | Elo: *${eloForPr(player.pr)}*`,
      '▢'
    );
  });
  lines.push('╰━━─「⚔️」─━━');
  return { ok: true, message: lines.join('\n'), mentions };
}

function createChallenge(message, argsText) {
  ensureSeason();
  ensureNoExpiredChallenges();
  const challenger = getOrCreatePlayerFromMessage(message, { touch: true });
  ensureRankedProfile(challenger.id);
  const targetId = getFirstMentionedId(message, argsText);
  if (!targetId) return { ok: false, message: 'Use assim: */desafio @pessoa*' };

  const challenged = getOrCreatePlayerByWhatsAppId(targetId, null, { touch: false });
  if (challenged.id === challenger.id) return { ok: false, message: 'Você não pode desafiar a si mesmo.' };
  ensureRankedProfile(challenged.id);

  const challengerRank = rankedProfile(challenger.id);
  const challengedRank = rankedProfile(challenged.id);

  if (fightCountToday(challenger.id) >= MAX_DAILY_FIGHTS) return { ok: false, message: 'Você já atingiu o limite de 5 lutas rankeadas hoje.' };
  if (fightCountToday(challenged.id) >= MAX_DAILY_FIGHTS) return { ok: false, message: 'Esse jogador já atingiu o limite de 5 lutas rankeadas hoje.' };
  const coolA = cooldownStatus(challenger.id);
  if (coolA.blocked) return { ok: false, message: coolA.message };
  const coolB = cooldownStatus(challenged.id);
  if (coolB.blocked) return { ok: false, message: `${mentionPlayer(challenged)} está em cooldown. ${coolB.message}`, mentions: [challenged.whatsapp_id] };

  if (activeChallengeForPlayer(challenger.id)) return { ok: false, message: 'Você já está em um desafio/luta pendente.' };
  if (activeChallengeForPlayer(challenged.id)) return { ok: false, message: 'Esse jogador já tem desafio pendente ou luta em andamento.' };

  const range = challengeRangeAllowed(challengerRank, challengedRank);
  if (!range.ok) return range;

  const info = db.prepare(`
    INSERT INTO ranked_fights (chat_id, challenger_id, challenged_id, date_key, accept_expires_at)
    VALUES (?, ?, ?, ?, datetime('now', '+5 hours'))
  `).run(message.from, challenger.id, challenged.id, dateKey());
  const code = `R${String(info.lastInsertRowid).padStart(4, '0')}`;
  db.prepare('UPDATE ranked_fights SET fight_code = ? WHERE id = ?').run(code, info.lastInsertRowid);

  return {
    ok: true,
    message: [
      '⚔️ *Desafio rankeado lançado!*',
      '',
      `🆔 Luta: *${code}*`,
      `🥊 Desafiante: ${mentionPlayer(challenger)} — PR ${challengerRank.pr}`,
      `🎯 Desafiado: ${mentionPlayer(challenged)} — PR ${challengedRank.pr}`,
      range.exception ? '⚠️ Exceção aplicada: não havia oponente próximo para o jogador com menos PR.' : null,
      '',
      `${mentionPlayer(challenged)}, use */Adesafio* para aceitar ou */Rdesafio* para recusar em até 5 horas.`,
    ].filter(Boolean).join('\n'),
    mentions: [challenger.whatsapp_id, challenged.whatsapp_id],
  };
}

function acceptChallenge(message) {
  ensureNoExpiredChallenges();
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const fight = db.prepare(`
    SELECT * FROM ranked_fights
    WHERE challenged_id = ? AND status = 'pending'
    ORDER BY id DESC LIMIT 1
  `).get(player.id);
  if (!fight) return { ok: false, message: 'Você não tem desafio rankeado pendente para aceitar.' };

  db.prepare(`
    UPDATE ranked_fights
    SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP,
        fight_expires_at = datetime('now', '+24 hours'), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(fight.id);

  const challenger = getRankedPlayer(fight.challenger_id);
  const challenged = getRankedPlayer(fight.challenged_id);
  return {
    ok: true,
    message: [
      '✅ *Desafio aceito!*',
      '',
      `🆔 Luta: *${fight.fight_code}*`,
      `${mentionPlayer(challenger)} vs ${mentionPlayer(challenged)}`,
      'A luta precisa terminar em até *24 horas*.',
      'Depois, Juiz Oficial/Admin/Alta Cúpula usa: */RV ID @vencedor*',
    ].join('\n'),
    mentions: [challenger.whatsapp_id, challenged.whatsapp_id],
  };
}

function refuseChallenge(message) {
  ensureNoExpiredChallenges();
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const fight = db.prepare(`
    SELECT * FROM ranked_fights
    WHERE challenged_id = ? AND status = 'pending'
    ORDER BY id DESC LIMIT 1
  `).get(player.id);
  if (!fight) return { ok: false, message: 'Você não tem desafio rankeado pendente para recusar.' };

  const count = fightCountToday(player.id);
  db.prepare(`
    UPDATE ranked_fights
    SET status = 'refused', result_type = 'recusado', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(fight.id);

  const challenger = getRankedPlayer(fight.challenger_id);
  return {
    ok: true,
    message: [
      '🚪 *Desafio recusado.*',
      '',
      count >= FREE_REFUSE_AFTER_FIGHTS
        ? 'Como você já fez 2 lutas hoje, a recusa foi registrada sem penalidade.'
        : 'Recusa registrada. Nenhum dos lados ganhou ou perdeu PR.',
      `Desafio de ${mentionPlayer(challenger)} foi encerrado.`,
    ].join('\n'),
    mentions: [player.whatsapp_id, challenger.whatsapp_id],
  };
}

async function canRegisterRankedWinner(message) {
  if (await isAdmin(message)) return true;
  const actor = getOrCreatePlayerFromMessage(message, { touch: true });
  if (isHighCouncilRoleId(actor.cargo_id)) return true;
  if (String(actor.trabalho_id || '').toUpperCase() === 'J.O') return true;
  return false;
}

async function registerWinner(message, argsText) {
  ensureNoExpiredChallenges();
  if (!(await canRegisterRankedWinner(message))) {
    return { ok: false, message: 'Apenas ADM, Alta Cúpula ou Juiz Oficial pode usar */RV*.' };
  }

  const code = firstArg(argsText);
  const winnerId = getFirstMentionedId(message, argsText);
  if (!code || !winnerId) return { ok: false, message: 'Use assim: */RV ID_DA_LUTA @vencedor*' };

  const fight = db.prepare(`
    SELECT * FROM ranked_fights
    WHERE UPPER(fight_code) = UPPER(?) AND status = 'accepted'
    LIMIT 1
  `).get(code);
  if (!fight) return { ok: false, message: 'Não encontrei essa luta aceita/em andamento.' };

  const winnerPlayer = getOrCreatePlayerByWhatsAppId(winnerId, null, { touch: false });
  if (![fight.challenger_id, fight.challenged_id].includes(winnerPlayer.id)) {
    return { ok: false, message: 'O vencedor marcado não faz parte dessa luta.' };
  }

  const outcome = applyNormalVictory(fight, winnerPlayer.id);
  const winner = getRankedPlayer(winnerPlayer.id);
  const loser = getRankedPlayer(outcome.loserId);

  return {
    ok: true,
    message: [
      '🏆 *Resultado rankeado registrado!*',
      '',
      `🆔 Luta: *${fight.fight_code}*`,
      `✅ Vencedor: ${mentionPlayer(winner)} — +${outcome.winnerPoints} PR / +${outcome.winnerPoints} PC`,
      `❌ Perdedor: ${mentionPlayer(loser)} — +${outcome.loserPoints} PR / +${outcome.loserPoints} PC`,
      '',
      `📊 ${mentionPlayer(winner)} agora tem PR *${winner.pr}* / PC *${winner.pc}* — ${eloForPr(winner.pr)}`,
      `📊 ${mentionPlayer(loser)} agora tem PR *${loser.pr}* / PC *${loser.pc}* — ${eloForPr(loser.pr)}`,
    ].join('\n'),
    mentions: [winner.whatsapp_id, loser.whatsapp_id],
  };
}

function firstArg(argsText = '') {
  return String(argsText || '').trim().split(/\s+/)[0] || '';
}

module.exports = {
  rankedRules,
  joinRanked,
  listRanked,
  createChallenge,
  acceptChallenge,
  refuseChallenge,
  registerWinner,
  ensureRankedProfile,
  rankedProfile,
  getRankedPlayer,
  eloForPr,
};
