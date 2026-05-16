const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');

/**
 * Busca vídeos no YouTube e retorna uma lista formatada (Substitui o Spotify).
 */
async function spotifySearch(message, command) {
    const text = command.argsText;
    if (!text) return message.reply(`Exemplo: ${command.usedPrefix}${command.name} Nome da Música`);

    try {
        const { data: res } = await axios.get("https://systemzone.store/api/ytsearch", {
            params: { text: text }
        });

        if (res.status !== "sucesso" || !res.resultados || res.resultados.length === 0) {
            return message.reply('Nenhum resultado encontrado.');
        }

        let responseText = `╭━━⪩ 🎥 *YOUTUBE SEARCH* ⪨━━\n`;
        responseText += `▢\n`;
        responseText += `▢ • *Busca:* ${text}\n`;
        responseText += `▢ • *Resultados:* ${res.resultados.length}\n`;
        responseText += `▢\n`;

        // Mostra os 10 primeiros resultados
        res.resultados.slice(0, 10).forEach((track, index) => {
            responseText += `▢ ${index + 1}. *${track.title}*\n`;
            responseText += `▢ ⤷ Canal: ${track.author}\n`;
            responseText += `▢ ⤷ Duração: ${track.duration}\n`;
            responseText += `▢ ⤷ Baixar: ${command.usedPrefix}spotify2 ${track.youtube_url}\n`;
            responseText += `▢\n`;
        });

        responseText += `╰━━─「🎬」─━━`;

        await message.reply(responseText);

    } catch (e) {
        console.error('Erro ao buscar no YouTube:', e);
        message.reply('Ocorreu um erro ao realizar a busca no YouTube.');
    }
}

/**
 * Faz o download do áudio do YouTube e envia (Substitui o spotify2).
 */
async function spotifyDownload(message, command, client) {
    const url = command.argsText;
    if (!url) return message.reply(`Exemplo: ${command.usedPrefix}${command.name} [link-youtube]`);

    try {
        const { data: res } = await axios.get("[link removido]
```player", {
            params: { text: url, apikey: "freekey" }
        });

        if (!res || !res.status) throw new Error('Falha na API de download do YouTube');

        // O bot baixa e converte a URL em áudio para o WhatsApp
        const media = await MessageMedia.fromUrl(res.download_url);

        await client.sendMessage(message.from, media, {
            sendAudioAsVoice: false,
            caption: `🎵 *${res.title}*`
        });

    } catch (e) {
        console.error('Erro no download do YouTube:', e);
        message.reply('Não foi possível processar o download desta música.');
    }
}

module.exports = {
    spotifySearch,
    spotifyDownload
};
