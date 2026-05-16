const db = require('../database/db');
const { money } = require('../utils/format');
const { recordLedger } = require('./ledgerService');
const { getPlayerByWhatsAppId, getPlayerClaim } = require('./playerService');
const { mentionPlayer, mentionIds } = require('../utils/mentions');

const TRAVEL_COST = 50_000_000; // 50kk
const TRAVEL_DURATION_HOURS = 24;

/**
 * Realiza a viagem de um jogador para um novo universo
 */
function viajar(message, destinationUniverseId) {
    const whatsappId = message.author || message.from;
    const player = getPlayerByWhatsAppId(whatsappId);
    
    if (!player) {
        return { ok: false, message: '❌ Você precisa estar registrado no RPG para viajar.' };
    }

    const claim = getPlayerClaim(player.id);
    if (!claim) {
        return { ok: false, message: '❌ Você não possui um personagem ocupado para viajar.' };
    }

    if (claim.universe_id === destinationUniverseId) {
        return { ok: false, message: `❌ Você já está no Universo ${destinationUniverseId}!` };
    }

    // Verificar se o universo de destino existe
    const targetUniverse = db.prepare('SELECT * FROM universes WHERE id = ?').get(destinationUniverseId);
    if (!targetUniverse) {
        return { ok: false, message: `❌ O Universo ${destinationUniverseId} não existe.` };
    }

    // Verificar saldo (50kk)
    if (player.zenies < TRAVEL_COST) {
        return { 
            ok: false, 
            message: `❌ Saldo insuficiente. A viagem custa *${money(TRAVEL_COST)} Zenies*. Você tem *${money(player.zenies)}*.` 
        };
    }

    const expiresAt = new Date(Date.now() + TRAVEL_DURATION_HOURS * 60 * 60 * 1000).toISOString();

    const transaction = db.transaction(() => {
        // Descontar o valor
        db.prepare('UPDATE players SET zenies = zenies - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(TRAVEL_COST, player.id);

        // Salvar registro da viagem para retorno automático
        db.prepare(`
            INSERT INTO travels (player_id, origin_universe_id, destination_universe_id, expires_at, status)
            VALUES (?, ?, ?, ?, 'active')
        `).run(player.id, claim.universe_id, destinationUniverseId, expiresAt);

        // Mover o personagem para o novo universo
        db.prepare('UPDATE character_claims SET universe_id = ?, created_at = CURRENT_TIMESTAMP WHERE player_id = ?')
          .run(destinationUniverseId, player.id);

        // Registrar no extrato/ledger
        recordLedger({
            playerId: player.id,
            direction: 'saida',
            category: 'viagem_universo',
            amount: TRAVEL_COST,
            description: `Viagem: U${claim.universe_id} ➔ U${destinationUniverseId}`
        });
    });

    transaction();

    return {
        ok: true,
        message: [
            '🌌 *VIAGEM INTER-UNIVERSAL* 🌌',
            '',
            `👤 Jogador: ${mentionPlayer(player)}`,
            `🚀 Destino: *Universo ${destinationUniverseId}*`,
            `💸 Custo: *${money(TRAVEL_COST)} Zenies*`,
            `⏳ Duração: *24 horas*`,
            '',
            'O bot removeu você do universo anterior e o alocou no novo. Após 24h, você será trazido de volta automaticamente.',
        ].join('\n'),
        mentions: [player.whatsapp_id]
    };
}

/**
 * Vincula um grupo a um número de universo (Comando de ADM)
 */
function linkarUniverso(chatId, universeId) {
    db.prepare(`
        INSERT INTO universe_links (chat_id, universe_id)
        VALUES (?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET universe_id = excluded.universe_id
    `).run(chatId, universeId);

    return { ok: true, message: `✅ Este grupo foi vinculado ao *Universo ${universeId}*!` };
}

/**
 * Verifica viagens expiradas e retorna os jogadores (Rodar na manutenção)
 */
function processExpiredTravels(client = null) {
    const now = new Date().toISOString();
    const expired = db.prepare(`
        SELECT t.*, p.whatsapp_id, p.display_name 
        FROM travels t
        JOIN players p ON p.id = t.player_id
        WHERE t.status = 'active' AND t.expires_at <= ?
    `).all(now);

    let count = 0;
    for (const travel of expired) {
        const transaction = db.transaction(() => {
            // Volta para o universo original
            db.prepare('UPDATE character_claims SET universe_id = ? WHERE player_id = ?')
              .run(travel.origin_universe_id, travel.player_id);

            // Finaliza o status da viagem
            db.prepare("UPDATE travels SET status = 'finished' WHERE id = ?").run(travel.id);
        });
        transaction();
        count++;

        // Opcional: Avisar o player no privado ou no chat se o client estiver disponível
        if (client) {
            client.sendMessage(travel.whatsapp_id, `⏳ *Viagem Expirada:* Suas 24h no Universo ${travel.destination_universe_id} acabaram. Você foi levado de volta ao Universo ${travel.origin_universe_id}.`).catch(() => {});
        }
    }

    return count;
}

module.exports = {
    viajar,
    linkarUniverso,
    processExpiredTravels
};
