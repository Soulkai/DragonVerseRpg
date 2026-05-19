const db = require('../database/db');
const { money } = require('../utils/format');
const { recordLedger } = require('./ledgerService');
const { getPlayerByWhatsAppId, getPlayerClaim } = require('./playerService');
const { mentionPlayer } = require('../utils/mentions');

const TRAVEL_COST = 50_000_000; // 50kk
const TRAVEL_DURATION_HOURS = 24;

async function viajar(message, destinationUniverseId, client) {
    const whatsappId = message.author || message.from;
    const player = getPlayerByWhatsAppId(whatsappId);
    
    if (!player) return { ok: false, message: '❌ Você precisa de registro para viajar.' };

    const claim = getPlayerClaim(player.id);
    if (!claim) return { ok: false, message: '❌ Você não possui um personagem ocupado.' };

    if (claim.universe_id === destinationUniverseId) {
        return { ok: false, message: `❌ Você já está no Universo ${destinationUniverseId}!` };
    }

    // Busca o grupo vinculado ao destino (/linkar)
    const destLink = db.prepare('SELECT chat_id FROM universe_links WHERE universe_id = ?').get(destinationUniverseId);
    if (!destLink) return { ok: false, message: '❌ Universo de destino não possui grupo vinculado.' };

    if (player.zenies < TRAVEL_COST) {
        return { ok: false, message: `❌ Custo: *${money(TRAVEL_COST)}*. Você tem *${money(player.zenies)}*.` };
    }

    try {
        const destChat = await client.getChatById(destLink.chat_id);
        
        // 1. Adiciona o player no novo grupo
        await destChat.addParticipants([whatsappId]);

        const transaction = db.transaction(() => {
            db.prepare('UPDATE players SET zenies = zenies - ? WHERE id = ?').run(TRAVEL_COST, player.id);
            db.prepare(`INSERT INTO travels (player_id, origin_universe_id, destination_universe_id, expires_at, status)
                        VALUES (?, ?, ?, ?, 'active')`).run(player.id, claim.universe_id, destinationUniverseId, new Date(Date.now() + TRAVEL_DURATION_HOURS * 60 * 60 * 1000).toISOString());
            db.prepare('UPDATE character_claims SET universe_id = ? WHERE player_id = ?').run(destinationUniverseId, player.id);
            
            recordLedger({
                playerId: player.id,
                direction: 'saida',
                category: 'viagem_universo',
                amount: TRAVEL_COST,
                description: `Viagem: U${claim.universe_id} ➔ U${destinationUniverseId}`
            });
        });
        transaction();

        // 2. Remove do grupo atual
        const currentChat = await message.getChat();
        if (currentChat.isGroup) {
            await currentChat.removeParticipants([whatsappId]);
        }

        return { ok: true, message: `🌌 Viagem concluída! ${mentionPlayer(player)} foi movido para o Universo ${destinationUniverseId}.` };
    } catch (e) {
        console.error(e);
        return { ok: false, message: '❌ Erro: O bot precisa ser ADM no grupo de destino para adicionar pessoas.' };
    }
}

function linkarUniverso(chatId, universeId) {
    db.prepare(`INSERT INTO universe_links (chat_id, universe_id) VALUES (?, ?)
                ON CONFLICT(chat_id) DO UPDATE SET universe_id = excluded.universe_id`).run(chatId, universeId);
    return { ok: true, message: `✅ Grupo vinculado ao *Universo ${universeId}*!` };
}

async function processExpiredTravels(client) {
    if (!client) return 0;
    const now = new Date().toISOString();
    const expired = db.prepare(`SELECT t.*, p.whatsapp_id, l_dest.chat_id as dest_chat, l_orig.chat_id as orig_chat 
                                FROM travels t 
                                JOIN players p ON p.id = t.player_id 
                                LEFT JOIN universe_links l_dest ON l_dest.universe_id = t.destination_universe_id
                                LEFT JOIN universe_links l_orig ON l_orig.universe_id = t.origin_universe_id
                                WHERE t.status = 'active' AND t.expires_at <= ?`).all(now);

    for (const travel of expired) {
        try {
            // Remove do destino e volta para a origem
            if (travel.dest_chat) {
                const dest = await client.getChatById(travel.dest_chat);
                await dest.removeParticipants([travel.whatsapp_id]);
            }
            if (travel.orig_chat) {
                const orig = await client.getChatById(travel.orig_chat);
                await orig.addParticipants([travel.whatsapp_id]);
            }

            db.prepare('UPDATE character_claims SET universe_id = ? WHERE player_id = ?').run(travel.origin_universe_id, travel.player_id);
            db.prepare("UPDATE travels SET status = 'finished' WHERE id = ?").run(travel.id);
        } catch (e) { console.error('Erro no retorno:', e); }
    }
    return expired.length;
}

module.exports = { viajar, linkarUniverso, processExpiredTravels };
