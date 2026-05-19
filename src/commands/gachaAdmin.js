const db = require('../database/db');

async function gachaAtivarCommand(message, command) {
    const groupId = message.from;

    // Verifica se o usuário é administrador do grupo (opcional, mas recomendado)
    const chat = await message.getChat();
    const participant = await chat.getParticipants();
    const isAdmin = participant.find(p => p.id._serialized === message.author && p.isAdmin);

    if (!isAdmin) return message.reply("❌ Apenas administradores podem ativar o Gacha neste grupo.");

    // Alterna o estado (Toggle)
    const current = db.prepare('SELECT is_enabled FROM gacha_chats WHERE chat_id = ?').get(groupId);
    const newState = current ? !current.is_enabled : 1;

    db.prepare(`
        INSERT INTO gacha_chats (chat_id, is_enabled) 
        VALUES (?, ?) 
        ON CONFLICT(chat_id) DO UPDATE SET is_enabled = ?
    `).run(groupId, newState ? 1 : 0, newState ? 1 : 0);

    await message.reply(newState ? "✅ *Sistema Gacha ATIVADO neste grupo!* Agora guerreiros podem surgir a qualquer momento." : "🛑 *Sistema Gacha DESATIVADO neste grupo!*");
}

module.exports = { gachaAtivarCommand };
