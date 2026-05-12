
const db = require('../database/db');

async function blockCmdCommand(message, command){
  const cmd = command.args[0];
  db.prepare(`INSERT OR IGNORE INTO blocked_commands (chat_id, command) VALUES (?, ?)`).run(message.from, cmd);
  return message.reply(`🚫 Bloqueado: ${cmd}`);
}

async function unblockCmdCommand(message, command){
  const cmd = command.args[0];
  db.prepare(`DELETE FROM blocked_commands WHERE chat_id = ? AND command = ?`).run(message.from, cmd);
  return message.reply(`✅ Liberado: ${cmd}`);
}

module.exports = { blockCmdCommand, unblockCmdCommand };
