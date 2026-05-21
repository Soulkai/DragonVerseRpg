const db = require('../database/db');

const activeSpawns = {};

async function spawnCharacter(client, groupId) {
    const char = db.prepare('SELECT id, name, rarity, element FROM character_catalog ORDER BY RANDOM() LIMIT 1').get();
    if (!char) return;

    const expiresAt = Date.now() + (10 * 60 * 1000);
    activeSpawns[groupId] = { ...char, expiresAt };

    const msg = `🚨 *ALERTA DE KI DETECTADO!* 🚨\n\n` +
                `Um guerreiro selvagem acabou de aparecer!\n` +
                `👤 *Nome:* ${char.name}\n` +
                `✨ *Raridade:* ${char.rarity}\n` +
                `🔥 *Elemento:* ${char.element}\n\n` +
                `Rápido! Use o comando *.capturar* antes que o tempo acabe!`;

    await client.sendMessage(groupId, msg);
}

function attemptCapture(groupId, playerId) {
    const spawn = activeSpawns[groupId];

    if (!spawn || Date.now() > spawn.expiresAt) {
        delete activeSpawns[groupId];
        return { success: false, message: "💨 Não há nenhum guerreiro por aqui, ou ele já fugiu usando o teletransporte!" };
    }

    const inventory = db.prepare('SELECT item_id, item_name, quantity FROM player_inventory WHERE player_id = ? AND quantity > 0').all(playerId);

    const mafuba = inventory.find(i => i.item_id === 'selo-mafuba' || String(i.item_name).toLowerCase().includes('mafuba'));
    const capsula = inventory.find(i => i.item_id === 'capsula-comum' || String(i.item_name).toLowerCase().includes('capsula'));

    let usedItem, itemName, finalChance;

    if (mafuba) {
        usedItem = mafuba;
        itemName = "Selo Mafuba";
        finalChance = 0.80; // fixo independente da raridade
    } else if (capsula) {
        usedItem = capsula;
        itemName = "Cápsula da Corporação";
        const captureChances = {
            'C': 0.80, 'U': 0.60, 'R': 0.40, 'S': 0.20,
            'SS': 0.10, 'SSS': 0.05, 'UR': 0.02, 'LR': 0.01, 'Godly': 0.001
        };
        finalChance = captureChances[spawn.rarity] ?? 0.50;
    } else {
        return { success: false, message: "🎒 Você não tem itens de captura! Compre uma *Cápsula da Corporação* ou um *Selo Mafuba* na Loja antes de tentar." };
    }

    db.prepare('UPDATE player_inventory SET quantity = quantity - 1 WHERE player_id = ? AND item_id = ?')
      .run(playerId, usedItem.item_id);

    const roll = Math.random();

    if (roll <= finalChance) {
        const existing = db.prepare('SELECT id, duplicates FROM player_collection WHERE player_id = ? AND character_id = ?').get(playerId, spawn.id);

        if (existing) {
            db.prepare('UPDATE player_collection SET duplicates = duplicates + 1 WHERE id = ?').run(existing.id);
        } else {
            db.prepare('INSERT INTO player_collection (player_id, character_id, level) VALUES (?, ?, 1)').run(playerId, spawn.id);
        }

        delete activeSpawns[groupId];

        return { success: true, message: `🎉 *CAPTURADO COM SUCESSO!*\n\nVocê atirou um(a) *${itemName}* e conseguiu pegar o *${spawn.name}* (Rank ${spawn.rarity})!\nEle já foi enviado para a sua Box.` };
    } else {
        return { success: false, message: `💥 *FALHOU!*\n\nVocê usou um(a) *${itemName}*, mas o *${spawn.name}* escapou com um golpe de Ki! Ainda dá tempo de tentar novamente!` };
    }
}

module.exports = { spawnCharacter, attemptCapture };
