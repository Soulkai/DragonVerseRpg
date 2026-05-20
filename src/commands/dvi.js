const db = require('../database/db');
const { updateAllPlayersDVI } = require('../systems/dvi');
const { money } = require('../utils/format');

async function dviCommand(message, command) {
    try {
        // Atualiza a matemática de todo mundo antes de exibir o ranking
        // (Em um bot com milhares de jogadores, faríamos isso de madrugada, mas aqui é leve)
        updateAllPlayersDVI();

        // Busca o Top 10 ordenado pelo DVI Score
        const topRicos = db.prepare(`
            SELECT p.display_name, r.dvi_score, r.collection_value, r.zenies_liquid
            FROM ranked_dvi r
            JOIN players p ON r.player_id = p.id
            ORDER BY r.dvi_score DESC
            LIMIT 10
        `).all();

        if (topRicos.length === 0) {
            return message.reply("📉 Nenhuma riqueza registrada ainda no Universo.");
        }

        let lines = [
            `🏆 *FORBES Z - DRAGONVERSE INDEX (DVI)* 🏆`,
            `Os guerreiros com o maior poderio econômico e coleção do Universo!`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            ''
        ];

        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

        topRicos.forEach((rico, index) => {
            const medal = medals[index] || '🎖️';
            lines.push(`${medal} *${rico.display_name}*`);
            lines.push(`  📈 DVI Score: *${money(rico.dvi_score)}*`);
            lines.push(`  🎒 Valor da Box: ${money(rico.collection_value)}`);
            lines.push(`  💰 Dinheiro Líquido: ${money(rico.zenies_liquid)}`);
            lines.push('');
        });

        lines.push(`💡 *O que é o DVI?*`);
        lines.push(`> É um cálculo do seu patrimônio total! Ele soma seus Zenies na mão, sua Poupança (vale 20% a mais!), o valor base dos personagens que você capturou e até seus gastos e dano em Raids!`);

        await message.reply(lines.join('\n'));

    } catch (error) {
        console.error('[ERRO no comando DVI]:', error);
        await message.reply("💥 O radar da Forbes pifou! Tente novamente mais tarde.");
    }
}

module.exports = { dviCommand };
