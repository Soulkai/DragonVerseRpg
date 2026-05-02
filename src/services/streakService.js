const db = require('../database/db');
const settings = require('../config/settings');
const { money } = require('../utils/format');
const { grantZenies } = require('./rewardService');

const STREAK_REWARDS = [
  { days: 3, type: 'zenies', amount: 100_000_000 },
  { days: 7, type: 'zenies', amount: 500_000_000 },
  { days: 15, type: 'zenies', amount: 1_000_000_000 },
  { days: 30, type: 'rare_code', amount: 0 },
];

function localDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone || 'America/Campo_Grande',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function addDays(dateKey, days) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseThresholds(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

function ensureStreak(playerId) {
  db.prepare(`
    INSERT INTO event_streaks (player_id)
    VALUES (?)
    ON CONFLICT(player_id) DO NOTHING
  `).run(playerId);

  return db.prepare('SELECT * FROM event_streaks WHERE player_id = ?').get(playerId);
}

function createRareStreakCode(playerId) {
  const code = `RARO-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  db.prepare(`
    INSERT INTO generic_codes (code, type, value, max_redemptions, redeemed_count, created_by)
    VALUES (?, 'desconto', 50, 1, 0, ?)
  `).run(code, `streak:${playerId}`);
  return code;
}

function registerPresence(playerId, reason = 'evento') {
  const today = localDateKey();
  const streak = ensureStreak(playerId);

  if (streak.last_presence_date === today) {
    return { changed: false, currentStreak: Number(streak.current_streak || 0), rewards: [] };
  }

  const yesterday = addDays(today, -1);
  const continued = streak.last_presence_date === yesterday;
  const current = continued ? Number(streak.current_streak || 0) + 1 : 1;
  const best = Math.max(Number(streak.best_streak || 0), current);
  const rewarded = continued ? parseThresholds(streak.rewarded_thresholds) : [];
  const rewards = [];

  for (const reward of STREAK_REWARDS) {
    if (current >= reward.days && !rewarded.includes(reward.days)) {
      rewarded.push(reward.days);
      if (reward.type === 'zenies') {
        grantZenies(playerId, reward.amount, `streak_${reward.days}`);
        rewards.push(`🔥 Streak ${reward.days} dias: +${money(reward.amount)} Zenies`);
      } else if (reward.type === 'rare_code') {
        const code = createRareStreakCode(playerId);
        rewards.push(`🎟️ Streak ${reward.days} dias: código raro gerado: *${code}*`);
      }
    }
  }

  db.prepare(`
    UPDATE event_streaks
    SET current_streak = ?,
        best_streak = ?,
        last_presence_date = ?,
        rewarded_thresholds = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ?
  `).run(current, best, today, JSON.stringify(rewarded.sort((a, b) => a - b)), playerId);

  void reason;
  return { changed: true, currentStreak: current, bestStreak: best, rewards };
}

function formatStreakStatus(playerId) {
  const streak = ensureStreak(playerId);
  const next = STREAK_REWARDS.find((reward) => Number(streak.current_streak || 0) < reward.days);
  return [
    '🔥 *Streak DragonVerse*',
    '',
    `Dias seguidos: *${streak.current_streak || 0}*`,
    `Melhor streak: *${streak.best_streak || 0}*`,
    `Última presença: *${streak.last_presence_date || 'Nenhuma'}*`,
    next ? `Próxima recompensa: *${next.days} dias*` : 'Você já alcançou todas as recompensas principais desse ciclo.',
  ].join('\n');
}

module.exports = {
  STREAK_REWARDS,
  localDateKey,
  registerPresence,
  formatStreakStatus,
};
