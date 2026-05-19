const db = require('../database/db'); // Ajuste o caminho se precisar

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
        delete activeSpawns[groupId];
        return { success: false, message: "💨 Não há nenhum guerreiro por aqui, ou ele já fugiu usando o teletransporte!" };
    }

    // ⚠️ CORREÇÃO: Puxa o inventário inteiro do jogador para evitar erros de busca no SQLite
    const inventory = db.prepare('SELECT item_id, item_name, quantity FROM player_inventory WHERE player_id = ? AND quantity > 0').all(playerId);

    let usedItem = null;
    let captureBonus = 0;
    let itemName = "";

    // ⚠️ Busca à prova de falhas: Olha tanto o ID quanto o NOME do item
    const mafuba = inventory.find(i => i.item_id === 'mafuba' || String(i.item_name).toLowerCase().includes('mafuba'));
    const capsula = inventory.find(i => i.item_id === 'capsula-comum' || String(i.item_name).toLowerCase().includes('cápsula') || String(i.item_name).toLowerCase().includes('capsula'));

    // Verifica primeiro se tem o Mafuba (que é melhor), se não, usa a cápsula normal
    if (mafuba) {
        usedItem = mafuba;
        captureBonus = 0.20; // O Mafuba dá +20% de chance de acerto!
        itemName = "Selo Mafuba";
    } else if (capsula) {
        usedItem = capsula;
        captureBonus = 0.0;
        itemName = "Cápsula da Corporação";
    } else {
        return { success: false, message: "🎒 Você não tem itens de captura! Compre uma *Cápsula da Corporação* ou um *Selo Mafuba* na Loja antes de tentar." };
    }

    // Gasta 1 unidade do item encontrado (usando o ID exato que o JS achou na mochila)
    db.prepare('UPDATE player_inventory SET quantity = quantity - 1 WHERE player_id = ? AND item_id = ?').run(playerId, usedItem.item_id);

    // Tabela de chances baseada no seu sistema
    const captureChances = {
        'C': 0.80, 'U': 0.60, 'R': 0.40, 'S': 0.20,
        'SS': 0.10, 'SSS': 0.05, 'UR': 0.02, 'LR': 0.01, 'Godly': 0.001
    };

    // Aplica o bônus do Mafuba (se estiver usando um)
    const baseChance = captureChances[spawn.rarity] || 0.50; 
    const finalChance = baseChance + captureBonus; 
    const roll = Math.random();

    if (roll <= finalChance) {
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
        
        return { success: true, message: `🎉 *CAPTURADO COM SUCESSO!*\n\nVocê atirou um(a) *${itemName}* e conseguiu pegar o *${charName}* (Rank ${charRarity})!\nEle já foi enviado para a sua Box.` };
    } else {
        delete activeSpawns[groupId];
        return { success: false, message: `💥 *FALHOU!*\n\nVocê usou um(a) *${itemName}*, mas o *${spawn.name}* escapou com um golpe de Ki e fugiu para longe!` };
    }
}

module.exports = { spawnCharacter, attemptCapture };
