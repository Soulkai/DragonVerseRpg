const { attemptCapture } = require('../systems/gacha'); // Ajuste o caminho se a pasta for diferente
const { getOrCreatePlayerFromMessage } = require('../services/playerService');

async function capturarCommand(message, commandArgs) {
    const groupId = message.from;

    try {
        // Usa a sua função perfeita para pegar (ou criar) o jogador instantaneamente
        const player = getOrCreatePlayerFromMessage(message); 
        
        if (!player) {
            await message.reply("❌ Ocorreu um erro ao acessar seu Ki nos registros do RPG.");
            return;
        }

        // Chama o motor de captura lá do gacha.js
        const result = attemptCapture(groupId, player.id);

        // Responde ao jogador com a mensagem de sucesso ou falha (já vem formatada do gacha.js)
        await message.reply(result.message);

    } catch (error) {
        console.error('[ERRO no comando Capturar]:', error);
        await message.reply("💥 Ocorreu uma anomalia no espaço-tempo ao tentar capturar o guerreiro.");
    }
}

module.exports = { capturarCommand };
