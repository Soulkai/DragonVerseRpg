const db = require('../database/db'); // Atualizado para a sua pasta correta

// Armazena quem está spawnado em cada grupo
const activeSpawns = {};

// Função para fazer o guerreiro aparecer (pode ser chamada a cada X minutos no index.js)
async function spawnCharacter(client, groupId) {
    // Busca um personagem aleatório no banco
    const char = db.prepare('SELECT id, name, rarity, element FROM character_catalog ORDER BY RANDOM() LIMIT 1').get();
    if (!char) return;

    // Fica disponível por 10 minutos
    const expiresAt = Date.now() + (10 * 60 * 1000);
    activeSpawns[groupId] = { ...char, expiresAt };

    const msg = `🚨 *ALERTA DE KI DETECTADO!* 🚨\n\n` +
                `Um guerreiro selvagem acabou de aparecer!\n` +
                `👤 *Nome:* ${char.name}\n` +
                `✨ *Raridade:* ${char.rarity}\n` +
                `🔥 *Elemento:* ${char.element}\n\n` +
                `Rápido! Use o comando *!capturar* antes que o tempo acabe!`;

    await client.sendMessage(groupId, msg);
}

// Lógica que será ativada quando o jogador digitar !capturar
function attemptCapture(groupId, playerId) {
    const spawn = activeSpawns[groupId];

    // Verifica se o bicho existe e não fugiu (tempo acabou)
    if (!spawn || Date.now() > spawn.expiresAt) {
        delete activeSpawns[groupId];
        return { success: false, message: "💨 Não há nenhum guerreiro por aqui, ou ele já fugiu usando o teletransporte!" };
    }

    // ⚠️ ATUALIZADO: Agora busca pelo ID de texto 'capsula-comum'
    const capsule = db.prepare("SELECT quantity FROM player_inventory WHERE player_id = ? AND item_id = 'capsula-comum'").get(playerId);
    
    if (!capsule || capsule.quantity <= 0) {
        return { success: false, message: "🎒 Você não tem *Cápsulas da Corporação*! Compre na loja antes de tentar capturar." };
    }

    // ⚠️ ATUALIZADO: Gasta 1 cápsula do jogador usando o ID de texto correto
    db.prepare("UPDATE player_inventory SET quantity = quantity - 1 WHERE player_id = ? AND item_id = 'capsula-comum'").run(playerId);

    // Tabela de chances baseada no seu sistema
    const captureChances = {
        'C': 0.80, 'U': 0.60, 'R': 0.40, 'S': 0.20,
        'SS': 0.10, 'SSS': 0.05, 'UR': 0.02, 'LR': 0.01, 'Godly': 0.001
    };

    const chance = captureChances[spawn.rarity] || 0.50; 
    const roll = Math.random();

    if (roll <= chance) {
        // Capturou! Salvar no banco
        const existing = db.prepare('SELECT id FROM player_collection WHERE player_id = ? AND character_id = ?').get(playerId, spawn.id);

        if (existing) {
            db.prepare('UPDATE player_collection SET duplicates = duplicates + 1 WHERE id = ?').run(existing.id);
        } else {
            db.prepare('INSERT INTO player_collection (player_id, character_id, level) VALUES (?, ?, 1)').run(playerId, spawn.id);
        }

        const charName = spawn.name;
        const charRarity = spawn.rarity;
        
        // Remove do mapa para que apenas o mais rápido consiga capturar
        delete activeSpawns[groupId]; 
        
        return { success: true, message: `🎉 *CAPTURADO!*\nVocê conseguiu capturar o *${charName}* (Rank ${charRarity})!\nEle já foi enviado para a sua Box.` };
    } else {
        delete activeSpawns[groupId];
        return { success: false, message: `💥 *FALHOU!*\nO *${spawn.name}* destruiu sua cápsula com um golpe de Ki e fugiu!` };
    }
}

module.exports = { spawnCharacter, attemptCapture };
