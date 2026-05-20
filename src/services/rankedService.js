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
const RANKED_TIMEZONE = 'America/Campo_Grande';
const CHALLENGE_START_HOUR = 6;
const CHALLENGE_END_HOUR = 22;
const WO_PAUSE_START_HOUR = 23;
const WO_PAUSE_END_HOUR = 6;

const PR_POINTS = {
  winDefault: 2,
  winVsHigher10: 5,
  winVsLower10: 1,
  loss: 1,
  woWin: 1,
  woLoss: -3,
};

const PC_POINTS = {
  winDefault: 15,
  winVsHigher10: 20,
  winVsLower10: 5,
  loss: 5,
  woWin: 5,
  woLoss: -3,
};

function dateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Campo_Grande' });
}

function seasonKey() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit' });
  return fmt.format(now);
}

function getRankedLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RANKED_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function localPartsToUtcDate(parts) {
  const desiredLocalMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour || 0,
    parts.minute || 0,
    parts.second || 0
  );

  let guess = new Date(desiredLocalMs);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actualParts = getRankedLocalParts(guess);
    const actualLocalMs = Date.UTC(
      actualParts.year,
      actualParts.month - 1,
      actualParts.day,
      actualParts.hour,
      actualParts.minute,
      actualParts.second
    );

    const diff = desiredLocalMs - actualLocalMs;
    if (diff === 0) return guess;
    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

function addLocalDays(parts, amount) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount, 12, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function sqliteTimestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function rankedDateTimeText(date) {
  return new Date(date).toLocaleString('pt-BR', { timeZone: RANKED_TIMEZONE });
}

function isChallengeWindowOpen(date = new Date()) {
  const parts = getRankedLocalParts(date);
  const minutes = parts.hour * 60 + parts.minute;
  const start = CHALLENGE_START_HOUR * 60;
  const end = CHALLENGE_END_HOUR * 60;
  return minutes >= start && minutes <= end;
}

function isWoPauseTime(date = new Date()) {
  const parts = getRankedLocalParts(date);
  const minutes = parts.hour * 60 + parts.minute;
  return minutes >= WO_PAUSE_START_HOUR * 60 || minutes < WO_PAUSE_END_HOUR * 60;
}

function moveToNextWoActiveTime(date) {
  if (!isWoPauseTime(date)) return new Date(date.getTime());

  const parts = getRankedLocalParts(date);
  if (parts.hour >= WO_PAUSE_START_HOUR) {
    const nextDay = addLocalDays(parts, 1);
    return localPartsToUtcDate({ ...nextDay, hour: WO_PAUSE_END_HOUR, minute: 0, second: 0 });
  }

  return localPartsToUtcDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: WO_PAUSE_END_HOUR,
    minute: 0,
    second: 0,
  });
}

function nextWoPauseStart(date) {
  const parts = getRankedLocalParts(date);
  return localPartsToUtcDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: WO_PAUSE_START_HOUR,
    minute: 0,
    second: 0,
  });
}

function addWoActiveHours(startDate, hours) {
  let current = moveToNextWoActiveTime(startDate);
  let remainingMinutes = Math.round(hours * 60);

  while (remainingMinutes > 0) {
    current = moveToNextWoActiveTime(current);

    const pauseStart = nextWoPauseStart(current);
    const availableMinutes = Math.max(0, Math.floor((pauseStart.getTime() - current.getTime()) / 60_000));

    if (availableMinutes <= 0) {
      current = moveToNextWoActiveTime(new Date(current.getTime() + 60_000));
      continue;
    }

    const consumed = Math.min(remainingMinutes, availableMinutes);
    current = new Date(current.getTime() + consumed * 60_000);
    remainingMinutes -= consumed;
  }

  return current;
}

function rankedDeadlineSql(hours) {
  return sqliteTimestamp(addWoActiveHours(new Date(), hours));
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
    message: `Você está em espera por ter ${isWinner ? 'vencido' : 'perdido'} uma luta. Libera em *${rankedDateTimeText(until)}*.`
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
        SET pr = MAX(pr + ?, 0), pc = MAX(pc + ?, 0), wo_losses = wo_losses + 1, updated_at = CURRENT_TIMESTAMP
        WHERE player_id IN (?, ?)
      `).run(PR_POINTS.woLoss, PC_POINTS.woLoss, fight.challenger_id, fight.challenged_id);
      db.prepare(`
        UPDATE ranked_fights
        SET status = 'wo_completed', result_type = 'duplo_wo', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(fight.id);
    })();
  }
}

function calculateWinPrPoints(winnerBefore, loserBefore) {
  const diff = Number(loserBefore.pr || 0) - Number(winnerBefore.pr || 0);
  if (diff >= 10) return PR_POINTS.winVsHigher10; // venceu alguém 10+ PR acima
  if (diff <= -10) return PR_POINTS.winVsLower10; // venceu alguém 10+ PR abaixo
  return PR_POINTS.winDefault;
}

function calculateWinPcPoints(winnerBefore, loserBefore) {
  const diff = Number(loserBefore.pr || 0) - Number(winnerBefore.pr || 0);
  if (diff >= 10) return PC_POINTS.winVsHigher10; // venceu alguém 10+ PR acima
  if (diff <= -10) return PC_POINTS.winVsLower10; // venceu alguém 10+ PR abaixo
  return PC_POINTS.winDefault;
}

function applyNormalVictory(fight, winnerId) {
  const loserId = fight.challenger_id === winnerId ? fight.challenged_id : fight.challenger_id;
  const winnerBefore = rankedProfile(winnerId);
  const loserBefore = rankedProfile(loserId);
  const winnerPrPoints = calculateWinPrPoints(winnerBefore, loserBefore);
  const winnerPcPoints = calculateWinPcPoints(winnerBefore, loserBefore);
  const loserPrPoints = PR_POINTS.loss;
  const loserPcPoints = PC_POINTS.loss;

  db.transaction(() => {
    db.prepare(`
      UPDATE ranked_profiles
      SET pr = pr + ?, pc = pc + ?, wins = wins + 1, updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(winnerPrPoints, winnerPcPoints, winnerId);
    db.prepare(`
      UPDATE ranked_profiles
      SET pr = pr + ?, pc = pc + ?, losses = losses + 1, updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(loserPrPoints, loserPcPoints, loserId);
    db.prepare(`
      UPDATE ranked_fights
      SET status = 'completed', winner_id = ?, result_type = 'normal', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(winnerId, fight.id);
  })();

  return { winnerPrPoints, winnerPcPoints, loserPrPoints, loserPcPoints, loserId };
}

function applyWoVictory(fight, winnerId, loserId, resultType = 'wo') {
  db.transaction(() => {
    db.prepare(`
      UPDATE ranked_profiles
      SET pr = pr + ?, pc = pc + ?, wo_wins = wo_wins + 1, updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(PR_POINTS.woWin, PC_POINTS.woWin, winnerId);
    db.prepare(`
      UPDATE ranked_profiles
      SET pr = MAX(pr + ?, 0), pc = MAX(pc + ?, 0), wo_losses = wo_losses + 1, updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?
    `).run(PR_POINTS.woLoss, PC_POINTS.woLoss, loserId);
    db.prepare(`
      UPDATE ranked_fights
      SET status = 'wo_completed', winner_id = ?, result_type = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(winnerId, resultType, fight.id);
  })();

  return {
    winnerPrPoints: PR_POINTS.woWin,
    winnerPcPoints: PC_POINTS.woWin,
    loserPrPoints: PR_POINTS.woLoss,
    loserPcPoints: PC_POINTS.woLoss,
    loserId,
  };
}

function rankedRules() {
  return {
    ok: true,
    message: [
      '╭━━⪩ ⚔️ *RANKEADA DRAGONVERSE* ⪨━━',
      '▢',
      '▢ • */iRank* — entra na lista rankeada.',
      '▢ • */listaRank* — mostra todos os inscritos.',
      '▢ • */desafio @pessoa* — desafia um jogador inscrito na rankeada.',
      '▢ • */adesafio* — aceita o desafio recebido.',
      '▢ • */rdesafio* — recusa o desafio recebido.',
      '▢ • */RV ID @pessoa* — juiz/admin registra vencedor.',
      '▢ • */removerrank @pessoa* — ADM/Alta Cúpula remove alguém da rankeada.',
      '▢',
      '▢ *Limites:*',
      `▢ • Máximo de *${MAX_DAILY_FIGHTS}* lutas por dia.`,
      '▢ • Vitória: espera de 1 hora para desafiar de novo.',
      '▢ • Derrota: espera de 3 horas para desafiar de novo.',
      '▢ • Com 2 lutas feitas no dia, pode recusar sem penalidade.',
      '▢ • Só é possível desafiar players que estejam na */listaRank*.',
      '▢ • Desafios só podem ser lançados das *06:00 às 22:00*.',
      '▢ • O tempo de W.O pausa das *23:00 às 06:00* e volta a contar às 06:00.',
      '▢ • Diferença máxima: 15 PR, com exceção para quem tem menos PR e não tem oponente próximo.',
      '▢',
      '▢ *Pontos de PR:*',
      '▢ • Vitória normal: +2 PR.',
      '▢ • Vitória contra alguém 10+ PR acima: +5 PR.',
      '▢ • Vitória contra alguém 10+ PR abaixo: +1 PR.',
      '▢ • Derrota normal: +1 PR.',
      '▢ • Vitória por W.O: +1 PR.',
      '▢ • Derrota por W.O: -3 PR.',
      '▢',
      '▢ *Pontos de PC:*',
      '▢ • Vitória normal: +15 PC.',
      '▢ • Vitória contra alguém 10+ PR acima: +20 PC.',
      '▢ • Vitória contra alguém 10+ PR abaixo: +5 PC.',
      '▢ • Derrota normal: +5 PC.',
      '▢ • Vitória por W.O: +5 PC.',
      '▢ • Derrota por W.O: -3 PC.',
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

  if (!isChallengeWindowOpen()) {
    return {
      ok: false,
      message: 'Desafios rankeados só podem ser feitos das *06:00 às 22:00* no horário do RPG.',
    };
  }

  const challenger = getOrCreatePlayerFromMessage(message, { touch: true });
  const challengerRank = rankedProfile(challenger.id);
  if (!challengerRank) {
    return { ok: false, message: 'Você ainda não está na lista rankeada. Use */iRank* primeiro.' };
  }

  const targetId = getFirstMentionedId(message, argsText);
  if (!targetId) return { ok: false, message: 'Use assim: */desafio @pessoa*' };

  const challenged = getPlayerByWhatsAppId(targetId);
  if (!challenged) {
    return { ok: false, message: 'Essa pessoa não está cadastrada no RPG e não está na lista rankeada.' };
  }

  if (challenged.id === challenger.id) return { ok: false, message: 'Você não pode desafiar a si mesmo.' };

  const challengedRank = rankedProfile(challenged.id);
  if (!challengedRank) {
    return {
      ok: false,
      message: `${mentionPlayer(challenged)} não está na lista rankeada. Ela precisa usar */iRank* antes de receber desafios.`,
      mentions: [challenged.whatsapp_id],
    };
  }

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

  const acceptExpiresAt = rankedDeadlineSql(ACCEPT_HOURS);
  const info = db.prepare(`
    INSERT INTO ranked_fights (chat_id, challenger_id, challenged_id, date_key, accept_expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(message.from, challenger.id, challenged.id, dateKey(), acceptExpiresAt);
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
      `${mentionPlayer(challenged)}, use */Adesafio* para aceitar ou */Rdesafio* para recusar em até 5 horas úteis de W.O.`,
      `⏳ Prazo calculado: *${rankedDateTimeText(new Date(`${acceptExpiresAt.replace(' ', 'T')}Z`))}*.`,
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

  const fightExpiresAt = rankedDeadlineSql(FIGHT_HOURS);
  db.prepare(`
    UPDATE ranked_fights
    SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP,
        fight_expires_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(fightExpiresAt, fight.id);

  const challenger = getRankedPlayer(fight.challenger_id);
  const challenged = getRankedPlayer(fight.challenged_id);
  return {
    ok: true,
    message: [
      '✅ *Desafio aceito!*',
      '',
      `🆔 Luta: *${fight.fight_code}*`,
      `${mentionPlayer(challenger)} vs ${mentionPlayer(challenged)}`,
      'A luta precisa terminar em até *24 horas úteis de W.O*.',
      `⏳ Prazo calculado: *${rankedDateTimeText(new Date(`${fightExpiresAt.replace(' ', 'T')}Z`))}*.`,
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

  const challengedFightCount = fightCountToday(player.id);
  const challenger = getRankedPlayer(fight.challenger_id);

  if (challengedFightCount >= FREE_REFUSE_AFTER_FIGHTS) {
    db.prepare(`
      UPDATE ranked_fights
      SET status = 'refused', result_type = 'recusado_sem_penalidade', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fight.id);

    return {
      ok: true,
      message: [
        '🚪 *Desafio recusado sem penalidade.*',
        '',
        'Como o desafiado já fez 2 lutas hoje, nenhum dos lados ganhou ou perdeu PR/PC.',
        `Desafio de ${mentionPlayer(challenger)} foi encerrado.`,
      ].join('\n'),
      mentions: [player.whatsapp_id, challenger.whatsapp_id],
    };
  }

  const outcome = applyWoVictory(fight, fight.challenger_id, fight.challenged_id, 'recusa_wo');
  const updatedChallenger = getRankedPlayer(fight.challenger_id);
  const updatedChallenged = getRankedPlayer(fight.challenged_id);

  return {
    ok: true,
    message: [
      '🚪 *Desafio recusado — derrota por W.O.*',
      '',
      `${mentionPlayer(updatedChallenged)} recusou o desafio e recebeu derrota por W.O.`,
      `${mentionPlayer(updatedChallenger)} venceu por W.O.`,
      '',
      `✅ ${mentionPlayer(updatedChallenger)}: +${outcome.winnerPrPoints} PR / +${outcome.winnerPcPoints} PC`,
      `❌ ${mentionPlayer(updatedChallenged)}: ${outcome.loserPrPoints} PR / ${outcome.loserPcPoints} PC`,
      '',
      `📊 ${mentionPlayer(updatedChallenger)} agora tem PR *${updatedChallenger.pr}* / PC *${updatedChallenger.pc}* — ${eloForPr(updatedChallenger.pr)}`,
      `📊 ${mentionPlayer(updatedChallenged)} agora tem PR *${updatedChallenged.pr}* / PC *${updatedChallenged.pc}* — ${eloForPr(updatedChallenged.pr)}`,
    ].join('\n'),
    mentions: [updatedChallenged.whatsapp_id, updatedChallenger.whatsapp_id],
  };
}

async function canRegisterRankedWinner(message) {
  if (await isAdmin(message)) return true;
  const actor = getOrCreatePlayerFromMessage(message, { touch: true });
  if (isHighCouncilRoleId(actor.cargo_id)) return true;
  if (String(actor.trabalho_id || '').toUpperCase() === 'J.O') return true;
  return false;
}


async function canRemoveRankedPlayer(message) {
  if (await isAdmin(message)) return true;
  const actor = getOrCreatePlayerFromMessage(message, { touch: true });
  return isHighCouncilRoleId(actor.cargo_id);
}

async function removeRankedPlayer(message, argsText) {
  ensureNoExpiredChallenges();
  if (!(await canRemoveRankedPlayer(message))) {
    return { ok: false, message: 'Apenas ADM ou Alta Cúpula pode usar */removerrank*.' };
  }

  const targetId = getFirstMentionedId(message, argsText);
  if (!targetId) return { ok: false, message: 'Use assim: */removerrank @pessoa*' };

  const target = getPlayerByWhatsAppId(targetId);
  if (!target) return { ok: false, message: 'Essa pessoa não está cadastrada no RPG.' };

  const profile = rankedProfile(target.id);
  if (!profile) {
    return {
      ok: false,
      message: `${mentionPlayer(target)} não está inscrito na rankeada.`,
      mentions: [target.whatsapp_id],
    };
  }

  const active = activeChallengeForPlayer(target.id);
  db.transaction(() => {
    if (active) {
      db.prepare(`
        UPDATE ranked_fights
        SET status = 'cancelled', result_type = 'removido_da_rank', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(active.id);
    }

    db.prepare('DELETE FROM ranked_profiles WHERE player_id = ?').run(target.id);
  })();

  return {
    ok: true,
    message: [
      '🗑️ *Player removido da rankeada.*',
      '',
      `Player: ${mentionPlayer(target)}`,
      `PR removido: *${profile.pr}*`,
      `PC removido: *${profile.pc}*`,
      active ? '⚠️ O desafio/luta pendente dessa pessoa também foi cancelado.' : null,
      '',
      'Para voltar à lista, a pessoa precisará usar */iRank* novamente.',
    ].filter(Boolean).join('\n'),
    mentions: [target.whatsapp_id],
  };
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
      `✅ Vencedor: ${mentionPlayer(winner)} — +${outcome.winnerPrPoints} PR / +${outcome.winnerPcPoints} PC`,
      `❌ Perdedor: ${mentionPlayer(loser)} — +${outcome.loserPrPoints} PR / +${outcome.loserPcPoints} PC`,
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
  removeRankedPlayer,
  ensureRankedProfile,
  rankedProfile,
  getRankedPlayer,
  eloForPr,
};
