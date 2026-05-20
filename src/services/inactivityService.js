const db = require('../database/db');
const { INACTIVITY_LIMIT_MONTHS } = require('../data/roles');

function purgeInactiveCharacters() {
  const inactivePlayers = db.prepare(`
    SELECT id
    FROM players
    WHERE last_active_at IS NOT NULL
      AND datetime(last_active_at) <= datetime('now', ?)
  `).all(`-${INACTIVITY_LIMIT_MONTHS} months`);

  if (inactivePlayers.length === 0) {
    return { removedClaims: 0, affectedPlayers: 0 };
  }

  const deleteClaim = db.prepare('DELETE FROM character_claims WHERE player_id = ?');
  let removedClaims = 0;

  const transaction = db.transaction((players) => {
    for (const player of players) {
      const info = deleteClaim.run(player.id);
      removedClaims += info.changes;
    }
  });

  transaction(inactivePlayers);

  return {
    removedClaims,
    affectedPlayers: inactivePlayers.length,
  };
}

module.exports = { purgeInactiveCharacters };
