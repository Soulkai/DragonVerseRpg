const db = require('../database/db');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');

async function boxCommand(message, command) {
    try {
        // Pega ou cria o jogador instantaneamente
        const player = getOrCreatePlayerFromMessage(message);
        if (!player) return;

        // Busca todos os guerreiros capturados pelo jogador ordenados por Raridade
        const collection = db.prepare(`
            SELECT c.name, c.slug, c.rarity, c.element, pc.level, pc.duplicates
            FROM player_collection pc
            JOIN character_catalog c ON pc.character_id = c.id
            WHERE pc.player_id = ?
            ORDER BY 
                CASE c.rarity
                    WHEN 'Godly' THEN 1
                    WHEN 'LR' THEN 2
                    WHEN 'UR' THEN 3
                    WHEN 'SSS' THEN 4
                    WHEN 'SS' THEN 5
                    WHEN 'S' THEN 6
                    WHEN 'R' THEN 7
                    WHEN 'U' THEN 8
                    WHEN 'C' THEN 9
                    ELSE 10
                END ASC, c.name ASC
        `).all(player.id);

        // Se a box estiver vazia, avisa o guerreiro
        if (collection.length === 0) {
            return message.reply("🎒 *Sua Box está vazia!*\n\nFique atento ao chat! Quando um alerta de Ki surgir, use o comando *!capturar* para iniciar sua coleção.");
        }

        // Agrupa os personagens por raridade em memória para formatar o texto
        const grouped = {};
        collection.forEach(char => {
            if (!grouped[char.rarity]) grouped[char.rarity] = [];
            grouped[char.rarity].push(char);
        });

        // Emojis temáticos para cada tier de poder
        const rarityIcons = {
            'Godly': '👑', 'LR': '🔱', 'UR': '💎', 'SSS': '🔥',
            'SS': '⚡', 'S': '✨', 'R': '⭐', 'U': '🔸', 'C': '🔹'
        };

        let lines = [
            `╭━━━ 🎒 *BOX DE GUERREIROS* ━━━╮`,
            `| 👤 *Lutador:* ${player.display_name}`,
            `| 🗃️ *Guerreiros Únicos:* ${collection.length}`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            ''
        ];

        // Varre as raridades na ordem de importância
        const order = ['Godly', 'LR', 'UR', 'SSS', 'SS', 'S', 'R', 'U', 'C'];
        for (const rarity of order) {
            if (grouped[rarity] && grouped[rarity].length > 0) {
                const icon = rarityIcons[rarity] || '▢';
                lines.push(`${icon} *RANK ${rarity}*`);
                
                grouped[rarity].forEach(char => {
                    const totalAmount = 1 + (char.duplicates || 0);
                    // Se o jogador tiver repetidos, mostra a quantidade acumulada
                    const duplicateStr = totalAmount > 1 ? ` *(x${totalAmount})*` : '';
                    lines.push(`  ▢ \`${char.slug}\` - ${char.name} [${char.element}]${duplicateStr}`);
                });
                lines.push('');
            }
        }

        lines.push(`💡 *Dica:* Use os \`slugs\` em destaque para invocar o seu time na Raid!`);
        lines.push(`👉 _Exemplo:_ \`!raid atacar ${collection[0]?.slug || 'goku-base'}\``);

        await message.reply(lines.join('\n'));

    } catch (error) {
        console.error('[ERRO no comando Box]:', error);
        await message.reply("💥 Ocorreu uma oscilação de Ki ao tentar abrir a sua Box.");
    }
}

module.exports = { boxCommand };
