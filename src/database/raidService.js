const db = require('../database/db');
const { money } = require('../utils/format');
const { grantZenies } = require('./rewardService');
const { getPlayerByWhatsAppId } = require('./playerService');
const { recordLedger } = require('./ledgerService');

const ELEMENT_TABLE = {
    'Fire': { beats: 'Ice', multiplier: 1.5 },
    'Ice': { beats: 'Energy', multiplier: 1.5 },
    'Energy': { beats: 'Physical', multiplier: 1.5 },
    'Physical': { beats: 'Divine', multiplier: 1.5 },
    'Divine': { beats: 'Fire', multiplier: 1.5 }
};

const RARITY_MULTIPLIERS = {
    'C': 1.0, 'U': 1.2, 'R': 1.5, 'S': 2.0, 
    'SS': 3.0, 'SSS': 5.0, 'UR': 8.0, 'LR': 12.0, 'Godly': 25.0
};

function getActiveRaid() {
    return db.prepare(`
        SELECT * FROM raid_bosses 
        WHERE status = 'active' AND datetime('now') < expires_at 
        ORDER BY id DESC LIMIT 1
    `).get();
}

function calculateAttack(playerKi, character) {
    const baseDamage = playerKi * 4000000;
    const rarityMult = RARITY_MULTIPLIERS[character.rarity] || 1.0;
    
    // Dano base = Ki * 4M * Multiplicador de Raridade
    return Math.floor(baseDamage * rarityMult * (character.base_damage_mult || 1.0));
}

function attackRaid(playerId, characterId) {
    const raid = getActiveRaid();
    if (!raid) return { ok: false, message: 'Nenhuma Raid ativa no momento!' };

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
    
    // 1. Verificar se o personagem pertence ao jogador e buscar dados do catálogo
    const character = db.prepare(`
        SELECT pc.*, cc.element, cc.rarity, cc.base_damage_mult, cc.name 
        FROM player_collection pc
        JOIN character_catalog cc ON pc.character_catalog_id = cc.id
        WHERE pc.player_id = ? AND pc.id = ?
    `).get(playerId, characterId);

    if (!character) return { ok: false, message: 'Você não possui esse personagem!' };

    // 2. Verificar limite diário (3 ataques por dia)
    const today = new Date().toISOString().split('T')[0];
    const attacksToday = db.prepare(`
        SELECT COUNT(*) as total FROM raid_logs 
        WHERE player_id = ? AND date(created_at) = ?
    `).get(playerId, today).total;

    if (attacksToday >= 3) return { ok: false, message: 'Você já atingiu o limite de 3 ataques diários na Raid!' };

    // 3. Lógica Elemental
    let elementalMult = 1.0;
    if (ELEMENT_TABLE[character.element]?.beats === raid.element) {
        elementalMult = ELEMENT_TABLE[character.element].multiplier;
    }

    const finalDamage = Math.floor(calculateAttack(player.ki_atual, character) * elementalMult);

    // 4. Aplicar dano e registrar log
    const transaction = db.transaction(() => {
        db.prepare('UPDATE raid_bosses SET hp_current = MAX(0, hp_current - ?) WHERE id = ?')
          .run(finalDamage, raid.id);
        
        db.prepare(`
            INSERT INTO raid_logs (raid_id, player_id, damage_dealt, characters_used_json)
            VALUES (?, ?, ?, ?)
        `).run(raid.id, playerId, finalDamage, JSON.stringify([character.name]));
        
        // Se HP chegar a 0, finaliza raid
        const updatedRaid = db.prepare('SELECT hp_current FROM raid_bosses WHERE id = ?').get(raid.id);
        if (updatedRaid.hp_current <= 0) {
            db.prepare("UPDATE raid_bosses SET status = 'defeated' WHERE id = ?").run(raid.id);
        }
    });
    transaction();

    return {
        ok: true,
        damage: finalDamage,
        bossHp: Math.max(0, raid.hp_current - finalDamage),
        elementalBonus: elementalMult > 1.0,
        characterName: character.name
    };
}

module.exports = {
    attackRaid,
    getActiveRaid,
    ELEMENT_TABLE
};
