const axios = require('axios');

// Cache local para guardar a pesquisa do usuário (Chave: WhatsApp ID)
const animeCache = new Map();

async function fetchAnimeSearch(query) {
    try {
        const { data } = await axios.get("https://systemzone.store/api/anime/search", {
            params: { q: query }
        });

        if (!data?.status || !data?.result) return null;

        const res = data.result;
        // Filtra para garantir que apenas episódios com links de player sejam listados
        const episodios = (res.episodios || []).filter(e => Array.isArray(e.players) && e.players.length > 0);

        if (!episodios.length) return null;

        return { anime: res.anime, episodios };
    } catch (error) {
        console.error('[animeService] Erro ao buscar API:', error.message);
        throw error;
    }
}

function saveAnimeCache(whatsappId, data) {
    animeCache.set(whatsappId, data);
}

function getAnimeCache(whatsappId) {
    return animeCache.get(whatsappId);
}

module.exports = {
    fetchAnimeSearch,
    saveAnimeCache,
    getAnimeCache
};
