const db = require('../database/db');

// Armazena quem está spawnado em cada grupo
const activeSpawns = {};

// Função para fazer o guerreiro aparecer
async function spawnCharacter(client, groupId) {
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

// Lógica de Captura
function attemptCapture(groupId, playerId) {
    const spawn = activeSpawns[groupId];

    // Verifica se o bicho existe e não fugiu (tempo acabou)
    if (!spawn || Date.now() > spawn.expiresAt) {
        delete activeSpawns[groupId]; // Limpa o spawn expirado
        return { success: false, message: "💨 Não há nenhum guerreiro por aqui, ou ele já fugiu usando o teletransporte!" };
    }

    // Puxa o inventário do jogador
    const inventory = db.prepare('SELECT item_id, item_name, quantity FROM player_inventory WHERE player_id = ? AND quantity > 0').all(playerId);

    let usedItem = null;
    let captureBonus = 0;
    let itemName = "";

    // Verifica Mafuba ou Cápsula
    const mafuba = inventory.find(i => i.item_id === 'selo-mafuba' || String(i.item_name).toLowerCase().includes('mafuba'));
    const capsula = inventory.find(i => i.item_id === 'capsula-comum' || String(i.item_name).toLowerCase().includes('capsula'));

    if (mafuba) {
        usedItem = mafuba;
        captureBonus = 0.20; 
        itemName = "Selo Mafuba";
    } else if (capsula) {
        usedItem = capsula;
        captureBonus = 0.0;
        itemName = "Cápsula da Corporação";
    } else {
        return { success: false, message: "🎒 Você não tem itens de captura! Compre uma *Cápsula da Corporação* ou um *Selo Mafuba* na Loja antes de tentar." };
    }

    // Gasta 1 unidade do item
    db.prepare('UPDATE player_inventory SET quantity = quantity - 1 WHERE player_id = ? AND item_id = ?').run(playerId, usedItem.item_id);

    // Chances
    const captureChances = {
        'C': 0.80, 'U': 0.60, 'R': 0.40, 'S': 0.20,
        'SS': 0.10, 'SSS': 0.05, 'UR': 0.02, 'LR': 0.01, 'Godly': 0.001
    };

    const baseChance = captureChances[spawn.rarity] || 0.50; 
    const finalChance = baseChance + captureBonus; 
    const roll = Math.random();

    if (roll <= finalChance) {
        // Sucesso: Salva no banco e remove o spawn pois foi capturado
        const existing = db.prepare('SELECT id, duplicates FROM player_collection WHERE player_id = ? AND character_id = ?').get(playerId, spawn.id);

        if (existing) {
            db.prepare('UPDATE player_collection SET duplicates = duplicates + 1 WHERE id = ?').run(existing.id);
        } else {
            db.prepare('INSERT INTO player_collection (player_id, character_id, level) VALUES (?, ?, 1)').run(playerId, spawn.id);
        }

        const charName = spawn.name;
        const charRarity = spawn.rarity;
        
        delete activeSpawns[groupId]; // Remove o spawn pois alguém pegou!
        
        return { success: true, message: `🎉 *CAPTURADO COM SUCESSO!*\n\nVocê atirou um(a) *${itemName}* e conseguiu pegar o *${charName}* (Rank ${charRarity})!\nEle já foi enviado para a sua Box.` };
    } else {
        // Falha: NÃO removemos o spawn. O guerreiro continua lá para outra tentativa!
        return { success: false, message: `💥 *FALHOU!*\n\nVocê usou um(a) *${itemName}*, mas o *${spawn.name}* escapou com um golpe de Ki! Ainda dá tempo de tentar novamente!` };
    }
}

module.exports = { spawnCharacter, attemptCapture };
