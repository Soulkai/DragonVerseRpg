const { fetchAnimeSearch, saveAnimeCache, getAnimeCache } = require('../services/animeService');

async function animeCommand(message, command) {
    const text = command.argsText;
    const prefix = command.prefix || '!';

    if (!text) {
        return message.reply(`╔━᳀『 🎌 Aɴɪᴍᴇ 』═᳀\n⌬ Use: *${prefix}anime <nome>*\n⌬ Ex: *${prefix}anime Naruto*\n╚━═━═━═━═━═━═━═━═━═᳀`);
    }

    // Reação de busca (padrão do whatsapp-web.js)
    await message.react("🔎");

    try {
        const data = await fetchAnimeSearch(text);

        if (!data) {
            await message.react("❌");
            return message.reply('Anime não encontrado ou sem episódios dublados/disponíveis.');
        }

        // Pega o ID único do usuário para salvar no cache
        const whatsappId = message.author || message.from;
        saveAnimeCache(whatsappId, data);

        let listText = 
            `╔━᳀『 🎌 Aɴɪᴍᴇ 』═᳀\n` +
            `⌬ *Título:* ${data.anime}\n` +
            `⌬ *Episódios:* ${data.episodios.length}\n` +
            `⌬ *Idioma:* Dublado\n` +
            `╚━═━═━═━═━═━═᳀\n\n` +
            `_Para assistir, envie:_\n*${prefix}animeep <numero>*\n_Exemplo:_ *${prefix}animeep 1*\n\n` +
            `*Lista de Episódios:*\n`;

        const limitList = Math.min(data.episodios.length, 50); 
        for (let i = 0; i < limitList; i++) {
            listText += `[ ${i + 1} ] - ${data.episodios[i].titulo || `Episódio ${i + 1}`}\n`;
        }

        if (data.episodios.length > limitList) {
            listText += `\n... e mais ${data.episodios.length - limitList} episódios disponíveis.`;
        }

        await message.reply(listText);
        await message.react("📺");

    } catch (e) {
        console.error('[animeCommand]', e.message);
        await message.react("❌");
        message.reply(`💥 Erro ao buscar anime: ${e.message}`);
    }
}

async function animeEpCommand(message, command) {
    const text = command.argsText;

    try {
        const whatsappId = message.author || message.from;
        const cache = getAnimeCache(whatsappId);

        if (!cache) {
            return message.reply(`Pesquise um anime primeiro usando o comando *!anime <nome>*`);
        }

        const userIndex = Number((text || '').trim());
        if (isNaN(userIndex) || userIndex < 1 || userIndex > cache.episodios.length) {
            return message.reply(`Episódio inválido. Escolha um número entre 1 e ${cache.episodios.length}.`);
        }

        const index = userIndex - 1; 
        const ep = cache.episodios[index];
        if (!ep) return message.reply('Episódio não encontrado.');

        const link = ep.players[0];

        await message.react("⏳");

        const epTexto =
            `╔━᳀『 Aɴɪᴍᴇ Eᴘɪsᴏ́ᴅɪᴏ 』═᳀\n` +
            `⌬ *Título:* ${cache.anime}\n` +
            `⌬ *Episódio:* ${userIndex}\n` +
            `⌬ *Idioma:* Dublado\n` +
            `╚━═━═━═━═━═━═᳀\n\n` +
            `*Link para assistir (Copie e cole no navegador se necessário):*\n${link}`;

        await message.reply(epTexto);
        await message.react("✅");

    } catch (e) {
        console.error('[animeEpCommand]', e.message);
        await message.react("❌");
        message.reply(`💥 Erro ao carregar episódio: ${e.message}`);
    }
}

module.exports = { animeCommand, animeEpCommand };
