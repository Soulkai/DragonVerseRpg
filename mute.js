
const db = require('../database/db');

async function muteCommand(message){
  const id = message.mentionedIds?.[0];
  if(!id) return message.reply("Marque alguém.");

  db.prepare(`INSERT OR REPLACE INTO muted_users (user_id) VALUES (?)`).run(id);
  return message.reply("🔇 Usuário mutado.");
}

async function unmuteCommand(message){
  const id = message.mentionedIds?.[0];
  db.prepare(`DELETE FROM muted_users WHERE user_id = ?`).run(id);
  return message.reply("🔊 Desmutado.");
}

module.exports = { muteCommand, unmuteCommand };
