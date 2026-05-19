const { attemptCapture } = require('../systems/gacha');
const { getPlayerByWhatsappId } = require('../services/playerService'); // Supondo que você tenha esse service, ajuste se necessário

async function capturarCommand(message, command = {}) {
    const groupId = message.from;
    const whatsappId = message.author || message.from; // Quem enviou a mensagem

    // Busca o ID interno do jogador no seu banco (Ajuste para a sua lógica atual)
    // Se você não tiver uma função assim, me avise que criamos!
    const player = getPlayerByWhatsappId(whatsappId); 
    
    if (!player) {
        await message.reply("❌ Você precisa se registrar no RPG primeiro!");
        return;
    }

    // Chama o motor de captura que criamos no gacha.js
    const result = attemptCapture(groupId, player.id);

    // Responde ao jogador com a mensagem de sucesso ou falha
    await message.reply(result.message);
}

module.exports = { capturarCommand };
