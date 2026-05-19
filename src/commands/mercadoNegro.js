const db = require('../database/db');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');
const { money } = require('../utils/format');

async function mercadoNegroCommand(message, command) {
    const player = getOrCreatePlayerFromMessage(message);
    const args = (command.argsText || '').split(' ');
    const action = args[0] ? args[0].toLowerCase() : 'listar'; // 'listar', 'vender', 'comprar', 'retirar'
    const prefix = command.prefix || '!';

    // ==========================================
    // 1. LISTAR O MERCADO
    // ==========================================
    if (action === 'listar') {
        const items = db.prepare(`
            SELECT bm.id, bm.price_zenies, c.name, c.rarity, p.display_name as seller
            FROM black_market bm
            JOIN character_catalog c ON bm.character_id = c.id
            JOIN players p ON bm.seller_id = p.id
            WHERE bm.status = 'active'
        `).all();

        if (items.length === 0) return message.reply("🌑 O Mercado Negro está vazio no momento.");

        let msg = "🌑 *MERCADO NEGRO*\n\n";
        items.forEach(i => {
            // Rank adicionado na exibição!
            msg += `🆔 ID: ${i.id} | *[Rank ${i.rarity}] ${i.name}* | Vendedor: ${i.seller} | Preço: ${money(i.price_zenies)} Z\n`;
        });
        
        msg += `\n🛒 *Comprar:* ${prefix}mercado comprar [ID]`;
        msg += `\n📦 *Vender:* ${prefix}mercado vender [slug] [preço]`;
        msg += `\n🔙 *Cancelar venda:* ${prefix}mercado retirar [ID]`;
        
        return message.reply(msg);
    }

    // ==========================================
    // 2. VENDER PERSONAGEM
    // ==========================================
    if (action === 'vender') {
        const slug = args[1];
        const price = Number(args[2]);
        if (!slug || !price || price <= 0) return message.reply(`Uso: ${prefix}mercado vender [slug] [preço]`);

        const char = db.prepare(`
            SELECT pc.id, pc.character_id, pc.duplicates 
            FROM player_collection pc
            JOIN character_catalog c ON pc.character_id = c.id
            WHERE pc.player_id = ? AND c.slug = ?
        `).get(player.id, slug);

        if (!char) return message.reply("❌ Você não possui esse personagem na sua box!");

        db.transaction(() => {
            // Coloca no mercado
            db.prepare("INSERT INTO black_market (seller_id, character_id, price_zenies) VALUES (?, ?, ?)").run(player.id, char.character_id, price);
            
            // 🛡️ CORREÇÃO: Remove apenas 1 duplicata, ou deleta se for o último
            if (char.duplicates > 0) {
                db.prepare("UPDATE player_collection SET duplicates = duplicates - 1 WHERE id = ?").run(char.id);
            } else {
                db.prepare("DELETE FROM player_collection WHERE id = ?").run(char.id);
            }
        })();
        
        return message.reply(`✅ *${slug}* colocado à venda no Mercado Negro por ${money(price)} Zenies!`);
    }

    // ==========================================
    // 3. COMPRAR PERSONAGEM
    // ==========================================
    if (action === 'comprar') {
        const marketId = Number(args[1]);
        if (!marketId) return message.reply(`Uso: ${prefix}mercado comprar [ID]`);

        const item = db.prepare("SELECT * FROM black_market WHERE id = ? AND status = 'active'").get(marketId);

        if (!item) return message.reply("❌ Item não encontrado ou já vendido.");
        if (item.seller_id === player.id) return message.reply("❌ Você não pode comprar seu próprio guerreiro.");
        if (player.zenies < item.price_zenies) return message.reply("❌ Zenies insuficientes!");

        db.transaction(() => {
            // Movimentação financeira
            db.prepare("UPDATE players SET zenies = zenies - ? WHERE id = ?").run(item.price_zenies, player.id);
            db.prepare("UPDATE players SET zenies = zenies + ? WHERE id = ?").run(item.price_zenies, item.seller_id);
            db.prepare("UPDATE black_market SET status = 'sold' WHERE id = ?").run(marketId);
            
            // 🛡️ CORREÇÃO: Verifica se o comprador já tem o boneco para evitar crash de UNIQUE constraint
            const existing = db.prepare("SELECT id FROM player_collection WHERE player_id = ? AND character_id = ?").get(player.id, item.character_id);
            
            if (existing) {
                db.prepare("UPDATE player_collection SET duplicates = duplicates + 1 WHERE id = ?").run(existing.id);
            } else {
                db.prepare("INSERT INTO player_collection (player_id, character_id, level) VALUES (?, ?, 1)").run(player.id, item.character_id);
            }
        })();

        return message.reply("✅ Compra realizada com sucesso! O guerreiro já foi transferido para a sua Box.");
    }

    // ==========================================
    // 4. RETIRAR DO MERCADO (NOVO)
    // ==========================================
    if (action === 'retirar' || action === 'cancelar') {
        const marketId = Number(args[1]);
        if (!marketId) return message.reply(`Uso: ${prefix}mercado retirar [ID]`);

        const item = db.prepare("SELECT * FROM black_market WHERE id = ? AND status = 'active'").get(marketId);

        if (!item) return message.reply("❌ Venda não encontrada ou já finalizada.");
        if (item.seller_id !== player.id) return message.reply("❌ Você só pode retirar os seus próprios guerreiros do mercado.");

        db.transaction(() => {
            // Cancela a venda
            db.prepare("UPDATE black_market SET status = 'cancelled' WHERE id = ?").run(marketId);
            
            // Devolve o personagem para o dono
            const existing = db.prepare("SELECT id FROM player_collection WHERE player_id = ? AND character_id = ?").get(player.id, item.character_id);
            
            if (existing) {
                db.prepare("UPDATE player_collection SET duplicates = duplicates + 1 WHERE id = ?").run(existing.id);
            } else {
                db.prepare("INSERT INTO player_collection (player_id, character_id, level) VALUES (?, ?, 1)").run(player.id, item.character_id);
            }
        })();

        return message.reply("🔙 Venda cancelada! O guerreiro retornou em segurança para a sua Box.");
    }
}

module.exports = { mercadoNegroCommand };
