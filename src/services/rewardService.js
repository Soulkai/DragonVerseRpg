const db = require('../database/db');
const { recordLedger } = require('./ledgerService');

const REFERRAL_BONUS_RATE = 0.10;

function getPlayerById(playerId) {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
}

function addZeniesDirect(playerId, amount) {
  if (!amount || amount <= 0) return 0;
  db.prepare(`
    UPDATE players
    SET zenies = zenies + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(Math.floor(amount), playerId);
  return Math.floor(amount);
}

function applyReferralBonus(recruitId, earnedAmount, source = 'ganho') {
  const amount = Math.floor(Number(earnedAmount || 0));
  if (amount <= 0) return 0;

  const referral = db.prepare(`
    SELECT * FROM player_referrals
    WHERE recruit_id = ?
      AND datetime(bonus_expires_at) > datetime('now')
    LIMIT 1
  `).get(recruitId);

  if (!referral) return 0;

  const bonus = Math.floor(amount * REFERRAL_BONUS_RATE);
  if (bonus <= 0) return 0;

  db.prepare(`
    UPDATE players
    SET zenies = zenies + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(bonus, referral.recruiter_id);

  db.prepare(`
    UPDATE player_referrals
    SET total_bonus_paid = total_bonus_paid + ?
    WHERE id = ?
  `).run(bonus, referral.id);

  db.prepare(`
    INSERT INTO transfer_history (from_player_id, to_player_id, amount)
    VALUES (?, ?, ?)
  `).run(recruitId, referral.recruiter_id, bonus);

  recordLedger({
    playerId: referral.recruiter_id,
    direction: 'entrada',
    category: 'bonus_indicacao',
    amount: bonus,
    relatedPlayerId: recruitId,
    description: `Bônus de indicação: 10% de ${source}`,
  });

  return bonus;
}

function grantZenies(playerId, amount, source = 'ganho', options = {}) {
  const value = Math.floor(Number(amount || 0));
  if (value <= 0) return { amount: 0, referralBonus: 0 };

  addZeniesDirect(playerId, value);
  recordLedger({
    playerId,
    direction: 'entrada',
    category: source,
    amount: value,
    description: options.description || source,
  });

  const referralBonus = options.skipReferral ? 0 : applyReferralBonus(playerId, value, source);
  return { amount: value, referralBonus };
}

module.exports = {
  REFERRAL_BONUS_RATE,
  getPlayerById,
  addZeniesDirect,
  applyReferralBonus,
  grantZenies,
};
