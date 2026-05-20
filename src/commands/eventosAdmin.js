const db = require('../database/db');

async function toggleEventosCommand(message) {
    const chat = await message.getChat();

    if (!chat.isGroup) return message.reply("❌ Este comando só pode ser usado em grupos.");

    const participants = await chat.getParticipants();
    const isAdmin = participants.find(p => p.id._serialized === message.author && p.isAdmin);

    if (!isAdmin) return message.reply("❌ Apenas administradores podem gerenciar o sistema.");

    // Busca o estado atual na tabela event_chats
    const current = db.prepare('SELECT is_enabled FROM event_chats WHERE chat_id = ?').get(message.from);
    const newState = current ? !current.is_enabled : 1;

    // Atualiza/Insere na tabela event_chats
    db.prepare(`
        INSERT INTO event_chats (chat_id, is_enabled) 
        VALUES (?, ?) 
        ON CONFLICT(chat_id) DO UPDATE SET is_enabled = ?
    `).run(message.from, newState ? 1 : 0, newState ? 1 : 0);

    await message.reply(newState ? "✅ *Sistemas DragonVerse (Eventos + Gacha) ATIVADOS!*" : "🛑 *Sistemas DragonVerse (Eventos + Gacha) DESATIVADOS!*");
}

module.exports = { toggleEventosCommand };
