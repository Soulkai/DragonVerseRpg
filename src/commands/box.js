const db = require('../database/db');
const { MessageMedia } = require('whatsapp-web.js');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');
const { money } = require('../utils/format');
const fs = require('fs');
const path = require('path');

const RARITY_BASE_VALUE = {
    'C': 1_000_000,
    'U': 5_000_000,
    'R': 20_000_000,
    'S': 100_000_000,
    'SS': 500_000_000,
    'SSS': 1_000_000_000,
    'UR': 2_500_000_000,
    'LR': 5_000_000_000,
    'Godly': 15_000_000_000,
};

function normalizeSlug(text = '') {
    return String(text || '').trim().toLowerCase();
}

function findSlugMedia(slug) {
    const extensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const base = path.resolve(process.cwd(), 'assets', 'slugs', slug);

    for (const ext of extensions) {
        const candidate = `${base}${ext}`;
        if (fs.existsSync(candidate)) return candidate;
    }

    return null;
}

async function sendSlugDetails(message, slugInput = '') {
    const slug = normalizeSlug(slugInput);
    if (!slug) {
        await message.reply('🔎 Use *!box slug nome-do-slug* para ver os detalhes de um guerreiro.\n\n👉 Exemplo: *!box slug goku-base*');
        return;
    }

    const character = db.prepare(`
        SELECT id, name, slug, rarity, element, base_damage_mult
        FROM character_catalog
        WHERE LOWER(slug) = ?
    `).get(slug);

    if (!character) {
        await message.reply(`❌ Nenhum guerreiro foi encontrado com o slug *${slug}*.`);
        return;
    }

    const baseValue = RARITY_BASE_VALUE[character.rarity] || 0;
    const owned = getOrCreatePlayerFromMessage(message, { touch: false });

    let ownershipLine = '🎒 *Na sua Box:* não capturado';
    if (owned?.id) {
        const row = db.prepare(`
            SELECT level, duplicates
            FROM player_collection
            WHERE player_id = ? AND character_id = ?
        `).get(owned.id, character.id);

        if (row) {
            const totalAmount = 1 + Number(row.duplicates || 0);
            ownershipLine = `🎒 *Na sua Box:* sim, Nv. ${row.level || 1} (x${totalAmount})`;
        }
    }

    const lines = [
        '╭━━━ 🧬 *FICHA DO GUERREIRO* ━━━╮',
        `| 🏷️ *Nome:* ${character.name}`,
        `| 🔖 *Slug:* ${character.slug}`,
        `| 🏆 *Rank:* ${character.rarity}`,
        `| 🌈 *Elemento:* ${character.element}`,
        `| 💥 *Dano Base:* x${Number(character.base_damage_mult || 1).toFixed(1)}`,
        `| 💰 *Valor Base (DVI):* ${money(baseValue)} Zenies`,
        `| ${ownershipLine.replace(/^🎒\s*/, '')}`,
        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
        '',
        '💡 *Caminho de imagem esperado:*',
        `assets/slugs/${character.slug}.png|jpg|jpeg|webp`,
    ];

    const caption = lines.join('\n');
    const mediaPath = findSlugMedia(character.slug);

    if (mediaPath) {
        const media = MessageMedia.fromFilePath(mediaPath);
        await message.reply(media, undefined, { caption });
        return;
    }

    await message.reply(caption);
}

async function listBox(message) {
    const player = getOrCreatePlayerFromMessage(message);
    if (!player) return;

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

    if (collection.length === 0) {
        return message.reply('🎒 *Sua Box está vazia!*\n\nFique atento ao chat! Quando um alerta de Ki surgir, use o comando *!capturar* para iniciar sua coleção.');
    }

    const grouped = {};
    collection.forEach(char => {
        if (!grouped[char.rarity]) grouped[char.rarity] = [];
        grouped[char.rarity].push(char);
    });

    const rarityIcons = {
        'Godly': '👑', 'LR': '🔱', 'UR': '💎', 'SSS': '🔥',
        'SS': '⚡', 'S': '✨', 'R': '⭐', 'U': '🔸', 'C': '🔹'
    };

    let lines = [
        '╭━━━ 🎒 *BOX DE GUERREIROS* ━━━╮',
        `| 👤 *Lutador:* ${player.display_name}`,
        `| 🗃️ *Guerreiros Únicos:* ${collection.length}`,
        '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
        ''
    ];

    const order = ['Godly', 'LR', 'UR', 'SSS', 'SS', 'S', 'R', 'U', 'C'];
    for (const rarity of order) {
        if (grouped[rarity] && grouped[rarity].length > 0) {
            const icon = rarityIcons[rarity] || '▢';
            lines.push(`${icon} *RANK ${rarity}*`);

            grouped[rarity].forEach(char => {
                const totalAmount = 1 + (char.duplicates || 0);
                const duplicateStr = totalAmount > 1 ? ` *(x${totalAmount})*` : '';
                lines.push(`  ▢ \`${char.slug}\` - ${char.name} [${char.element}]${duplicateStr}`);
            });
            lines.push('');
        }
    }

    lines.push('💡 *Dica:* Use os `slugs` em destaque para invocar o seu time na Raid!');
    lines.push(`🔎 *Novo:* Use *!box slug ${collection[0]?.slug || 'goku-base'}* para ver a ficha completa de um guerreiro.`);
    lines.push(`👉 _Exemplo Raid:_ \`!raid atacar ${collection[0]?.slug || 'goku-base'}\``);

    await message.reply(lines.join('\n'));
}

async function boxCommand(message, command = {}) {
    try {
        const argsText = String(command.argsText || '').trim();
        const [subcommand, ...rest] = argsText.split(/\s+/);
        const sub = String(subcommand || '').toLowerCase();

        if (sub === 'slug') {
            await sendSlugDetails(message, rest.join(' '));
            return;
        }

        await listBox(message);
    } catch (error) {
        console.error('[ERRO no comando Box]:', error);
        await message.reply('💥 Ocorreu uma oscilação de Ki ao tentar abrir a sua Box.');
    }
}

module.exports = { boxCommand };
