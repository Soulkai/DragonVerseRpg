const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');

/**
 * Busca músicas no Spotify e retorna uma lista formatada.
 */
async function spotifySearch(message, command) {
    const text = command.argsText;
    if (!text) return message.reply(`Exemplo: ${command.usedPrefix}${command.name} Slash Inferno`);

    try {
        const { data: res } = await axios.get("https://systemzone.store/api/search/spotify", {
            params: { q: text, limit: 10, apikey: "freekey" }
        });

        if (!res.status || !res.result || res.result.length === 0) {
            return message.reply('Nenhum resultado encontrado.');
        }

        let responseText = `╭━━⪩ 🎵 *SPOTIFY SEARCH* ⪨━━\n`;
        responseText += `▢\n`;
        responseText += `▢ • *Busca:* ${text}\n`;
        responseText += `▢ • *Resultados:* ${res.result.length}\n`;
        responseText += `▢\n`;

        res.result.forEach((track, index) => {
            responseText += `▢ ${index + 1}. *${track.title}*\n`;
            responseText += `▢ ⤷ Artista: ${track.artists}\n`;
            responseText += `▢ ⤷ Duração: ${track.duration}\n`;
            responseText += `▢ ⤷ Baixar: ${command.usedPrefix}spotify2 ${track.url}\n`;
            responseText += `▢\n`;
        });

        responseText += `╰━━─「🎧」─━━`;

        await message.reply(responseText);
    } catch (e) {
        console.error('Erro ao buscar no Spotify:', e);
        message.reply('Ocorreu um erro ao realizar a busca no Spotify.');
    }
}

/**
 * Faz o download da música do Spotify e envia como áudio.
 */
async function spotifyDownload(message, command, client) {
    const url = command.argsText;
    if (!url) return message.reply(`Exemplo: ${command.usedPrefix}${command.name} [link-spotify]`);

    try {
        const { data: res } = await axios.get("https://systemzone.store/api/v1/spotify", {
            params: { text: url, apikey: "freekey" }
        });

        if (!res || !res.status) throw new Error('Falha na API de download');

        const audioUrl = res.download_url.replace(/^http:\/\//i, 'https://');
        const media = await MessageMedia.fromUrl(audioUrl);

        await client.sendMessage(message.from, media, {
            sendAudioAsVoice: false,
            caption: `🎵 *${res.title}*`
        });

    } catch (e) {
        console.error('Erro no download do Spotify:', e);
        message.reply('Não foi possível processar o download desta música.');
    }
}

module.exports = {
    spotifySearch,
    spotifyDownload
};
