const db = require('../database/db');
const { getOrCreatePlayerFromMessage } = require('../services/playerService');
const { attackRaidBoss } = require('../systems/raids');
const { money } = require('../utils/format'); // Supondo que você tem essa função de formatar números

async function raidCommand(message, command) {
    const player = getOrCreatePlayerFromMessage(message);
    if (!player) return;

    const args = (command.argsText || '').toLowerCase().split(' ').filter(Boolean);
    const action = args[0]; // pode ser vazio, 'info' ou 'atacar'

    // Pega o boss atual
    const activeBoss = db.prepare("SELECT * FROM raid_bosses WHERE status = 'active'").get();

    // 1. Mostrar o status da Raid (!raid)
    if (!action || action === 'info') {
        if (!activeBoss) {
            const nextBoss = db.prepare("SELECT starts_at FROM raid_bosses WHERE status = 'scheduled' ORDER BY starts_at ASC LIMIT 1").get();
            if (nextBoss) {
                const dataStr = new Date(nextBoss.starts_at).toLocaleDateString('pt-BR');
                return message.reply(`A paz reina no universo... O próximo Boss Global está previsto para aparecer dia *${dataStr}*. Prepare sua Box de guerreiros!`);
            }
            return message.reply("A paz reina no universo... Não há alertas de Raid no momento.");
        }

        // Pega o top 3 de dano atual
        const topDamage = db.prepare(`
            SELECT p.display_name, SUM(rl.damage_dealt) as total_dmg
            FROM raid_logs rl
            JOIN players p ON rl.player_id = p.id
            WHERE rl.raid_id = ?
            GROUP BY p.id
            ORDER BY total_dmg DESC
            LIMIT 3
        `).all(activeBoss.id);

        let msg = `🔥 *RAID ATIVA: ${activeBoss.name}* 🔥\n\n`;
        msg += `🌟 *Elemento:* ${activeBoss.element}\n`;
        msg += `❤️ *HP:* ${money(activeBoss.hp_current)} / ${money(activeBoss.hp_max)}\n\n`;
        
        msg += `🏆 *Top 3 Contribuições:*\n`;
        if (topDamage.length === 0) msg += `> Ninguém teve a coragem de atacar ainda.\n`;
        topDamage.forEach((t, i) => {
            msg += `${i + 1}º ${t.display_name} - ${money(t.total_dmg)} Dano\n`;
        });

        msg += `\n⚔️ *Como atacar:* Use \`!raid atacar slug1 slug2 slug3\`\n`;
        msg += `(Ex: !raid atacar goku-base kuririn-z piccolo-capa)`;

        return message.reply(msg);
    }

    // 2. Atacar o Boss (!raid atacar goku vegeta piccolo)
    if (action === 'atacar' || action === 'attack') {
        const slugs = args.slice(1);

        if (slugs.length !== 3) {
            return message.reply("⚠️ Estratégia inválida! Você precisa enviar exatamente *3 guerreiros* para a Raid. Ex: `!raid atacar goku-base vegeta-scouter piccolo-capa`");
        }

        const result = attackRaidBoss(player.id, slugs);

        if (result.error) {
            return message.reply(`❌ ${result.error}`);
        }

        if (result.defeated) {
            let winMsg = `🎉 *A AMEAÇA FOI ELIMINADA!* 🎉\n\n`;
            winMsg += `Com um combo final de *${money(result.damage)}* de Dano, você desferiu o golpe fatal e derrotou *${result.bossName}*!\n\n`;
            winMsg += `A patrulha galáctica já está calculando as recompensas (Zenies e Pontos DVI) com base na contribuição de todos. O universo está a salvo!`;
            return message.reply(winMsg);
        } else {
            let hitMsg = `💥 *BOOOM!* 💥\n\n`;
            hitMsg += `O seu time atacou o *${result.bossName}* e causou incríveis *${money(result.damage)}* de Dano!\n`;
            hitMsg += `❤️ Restam ${money(result.hpLeft)} de HP no Boss.\n\n`;
            hitMsg += `Seus personagens estão exaustos e não poderão ser usados novamente nesta temporada. Volte amanhã com uma nova equipe!`;
            return message.reply(hitMsg);
        }
    }
}

module.exports = { raidCommand };
