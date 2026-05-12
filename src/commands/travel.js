
const db = require('../database/db');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');

const COST = 50000000;

async function linkarCommand(message, command){
  const uni = command.args[0];
  db.prepare(`INSERT OR REPLACE INTO universe_links (universe_id, created_at) VALUES (?, datetime('now'))`).run(uni);
  return message.reply(`🌌 Universo ${uni} linkado.`);
}

async function viajarCommand(message, command){
  const target = command.args[0];
  const player = getOrCreatePlayerFromMessage(message,{touch:true});

  db.prepare(`UPDATE players SET zenies = zenies - ? WHERE id = ?`).run(COST, player.id);

  db.prepare(`
    INSERT INTO universe_travel (player_id, from_universe, to_universe, start_time, end_time)
    VALUES (?, ?, ?, datetime('now'), datetime('now', '+24 hours'))
  `).run(player.id, player.universe, target);

  return message.reply(`🚀 Viagem iniciada para U${target}. Custo 50kk.`);
}

module.exports = { linkarCommand, viajarCommand };
