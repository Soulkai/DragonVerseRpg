const { viajar, linkarUniverso } = require('../services/travelService');
const { replyWithMentions } = require('../utils/reply');
const { isAdmin } = require('../utils/admin');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');

/**
 * Comando para viajar entre universos ou linkar grupos (ADM)
 * Uso: /viajar universo 2 ou /linkar 2
 */
async function viagemCommand(message, command, client) {
    const action = command.name; // 'viajar' ou 'linkar'
    const args = command.args;

    // Lógica para /linkar [Numero] (Apenas ADMs)
    if (action === 'linkar') {
        const admin = await isAdmin(message);
        if (!admin) {
            return message.reply('❌ Apenas administradores podem linkar este grupo a um universo.');
        }

        const universeId = parseInt(args[0]);
        if (isNaN(universeId)) {
            return message.reply('❌ Informe o número do universo. Ex: */linkar 2*');
        }

        const result = linkarUniverso(message.from, universeId);
        return message.reply(result.message);
    }

    // Lógica para /viajar universo [Numero]
    if (action === 'viajar') {
        // Verifica se o argumento "universo" foi passado
        if (args[0]?.toLowerCase() !== 'universo' || isNaN(parseInt(args[1]))) {
            return message.reply('❌ Use o formato correto: */viajar universo [numero]*\nExemplo: */viajar universo 2*');
        }

        const destinationId = parseInt(args[1]);
        
        // Chama o serviço de viagem
        const result = viajar(message, destinationId);

        // Responde marcando o player
        await replyWithMentions(message, result, client);
    }
}

module.exports = { viagemCommand };
