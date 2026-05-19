const db = require('../database/db');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');
const { money } = require('../utils/format');

async function mercadoNegroCommand(message, command) {
    const player = getOrCreatePlayerFromMessage(message);
    const args = (command.argsText || '').split(' ');
    const action = args[0]; // 'listar', 'vender', 'comprar'

    if (!action || action === 'listar') {
        const items = db.prepare(`
            SELECT bm.id, bm.price_zenies, c.name, p.display_name as seller
            FROM black_market bm
            JOIN character_catalog c ON bm.character_id = c.id
            JOIN players p ON bm.seller_id = p.id
            WHERE bm.status = 'active'
        `).all();

        if (items.length === 0) return message.reply("🌑 O Mercado Negro está vazio no momento.");

        let msg = "🌑 *MERCADO NEGRO*\n\n";
        items.forEach(i => {
            msg += `🆔 ID: ${i.id} | *${i.name}* | Vendedor: ${i.seller} | Preço: ${money(i.price_zenies)} Zenies\n`;
        });
        msg += "\nUse *!mercado comprar [ID]*";
        return message.reply(msg);
    }

    if (action === 'vender') {
        const slug = args[1];
        const price = Number(args[2]);
        if (!slug || !price || price <= 0) return message.reply("Uso: !mercado vender [slug] [preço]");

        const char = db.prepare(`
            SELECT pc.id, pc.character_id 
            FROM player_collection pc
            JOIN character_catalog c ON pc.character_id = c.id
            WHERE pc.player_id = ? AND c.slug = ?
        `).get(player.id, slug);

        if (!char) return message.reply("❌ Você não possui esse personagem na sua box!");

        db.prepare("INSERT INTO black_market (seller_id, character_id, price_zenies) VALUES (?, ?, ?)").run(player.id, char.character_id, price);
        db.prepare("DELETE FROM player_collection WHERE id = ?").run(char.id); // Remove da box do vendedor
        
        return message.reply(`✅ *${slug}* colocado à venda por ${money(price)} Zenies!`);
    }

    if (action === 'comprar') {
        const marketId = Number(args[1]);
        const item = db.prepare("SELECT * FROM black_market WHERE id = ? AND status = 'active'").get(marketId);

        if (!item) return message.reply("❌ Item não encontrado ou já vendido.");
        if (item.seller_id === player.id) return message.reply("❌ Você não pode comprar seu próprio item.");
        if (player.zenies < item.price_zenies) return message.reply("❌ Zenies insuficientes!");

        db.transaction(() => {
            db.prepare("UPDATE players SET zenies = zenies - ? WHERE id = ?").run(item.price_zenies, player.id);
            db.prepare("UPDATE players SET zenies = zenies + ? WHERE id = ?").run(item.price_zenies, item.seller_id);
            db.prepare("UPDATE black_market SET status = 'sold' WHERE id = ?").run(marketId);
            db.prepare("INSERT INTO player_collection (player_id, character_id) VALUES (?, ?)").run(player.id, item.character_id);
        })();

        return message.reply("✅ Compra realizada com sucesso! O personagem já está na sua Box.");
    }
}

module.exports = { mercadoNegroCommand };
