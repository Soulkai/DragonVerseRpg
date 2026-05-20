const db = require('../database/db');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');

async function boxCommand(message, command) {
    try {
        // Pega ou cria o lutador no ecossistema
        const player = getOrCreatePlayerFromMessage(message);
        if (!player) return;

        // 🛠️ CONSULTA ADAPTADA: Usando exatamente as colunas da sua estrutura oficial
        const collection = db.prepare(`
            SELECT 
                catalog.name, 
                catalog.slug, 
                catalog.rarity, 
                catalog.element, 
                coll.level, 
                coll.duplicates
            FROM player_collection coll
            JOIN character_catalog catalog ON catalog.id = coll.character_id
            WHERE coll.player_id = ?
            ORDER BY 
                CASE catalog.rarity
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
                END ASC, catalog.name ASC
        `).all(player.id);

        // Se a box estiver vazia, avisa o guerreiro com as instruções de spawn
        if (collection.length === 0) {
            return message.reply("🎒 *Sua Box está vazia!*\n\nFique atento ao chat! Quando um alerta de Ki surgir, use o comando *!capturar* para iniciar sua coleção.");
        }

        // Agrupa os guerreiros por rank de poder em memória
        const grouped = {};
        collection.forEach(char => {
            if (!grouped[char.rarity]) grouped[char.rarity] = [];
            grouped[char.rarity].push(char);
        });

        // Design visual clássico baseado nas caixas do seu RPG
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

        // Varre na ordem do meta-game (Mais fortes para os mais fracos)
        const order = ['Godly', 'LR', 'UR', 'SSS', 'SS', 'S', 'R', 'U', 'C'];
        for (const rarity of order) {
            if (grouped[rarity] && grouped[rarity].length > 0) {
                const icon = rarityIcons[rarity] || '▢';
                lines.push(`${icon} *RANK ${rarity}*`);
                
                grouped[rarity].forEach(char => {
                    // Soma 1 (o original) + as duplicatas para mostrar o acúmulo real
                    const totalAmount = 1 + (char.duplicates || 0);
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
