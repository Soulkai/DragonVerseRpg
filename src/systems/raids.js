const db = require('../database/db'); // Ajuste o caminho
const { getPlayerByWhatsAppId } = require('../services/playerService');

// ==========================================
// ⚙️ CONFIGURAÇÕES DA RAID
// ==========================================
const RAID_DURATION_DAYS = 14; // Dura 2 semanas
const RAID_INTERVAL_DAYS = 30; // 1 Mês entre o início de uma e outra

const BOSS_TEMPLATES = [
    { name: "Vegeta Oozaru Selvagem", element: "Fisico", hp: 10000000 },
    { name: "Imperador Freeza (100%)", element: "Trevas", hp: 50000000 },
    { name: "Cell Super Perfeito", element: "Energia", hp: 150000000 },
    { name: "Majin Boo (Pura Maldade)", element: "Magia", hp: 300000000 },
    { name: "Jiren, o Cinzento", element: "Fogo", hp: 800000000 },
    { name: "Goku Black (Rosé)", element: "Divino", hp: 1000000000 }
];

// Multiplicador por raridade na Raid
const RARITY_RAID_MULTIPLIER = {
    'C': 0.9,
    'U': 1.0,
    'R': 1.05,
    'S': 1.15,
    'SS': 1.25,
    'SSS': 1.4,
    'UR': 1.6,
    'LR': 1.85,
    'Godly': 2.2
};

// Sinergias Elementais (Quem bate em quem)
const elementAdvantage = {
    'Fogo': ['Gelo', 'Natureza'],
    'Gelo': ['Vento', 'Energia'],
    'Energia': ['Fisico'],
    'Fisico': ['Tecnologico', 'Magia'],
    'Divino': ['Trevas', 'Demônio'],
    'Luz': ['Trevas', 'Divino'],
    'Trevas': ['Magia', 'Fisico'],
    'Tecnologico': ['Magia'],
    'Magia': ['Energia'],
    'Omni': ['Fogo', 'Gelo', 'Energia', 'Fisico', 'Divino', 'Luz', 'Trevas', 'Tecnologico', 'magia']
};

function getSynergyMultiplier(playerElement, bossElement) {
    if (elementAdvantage[playerElement] && elementAdvantage[playerElement].includes(bossElement)) {
        return 1.5; // 50% a mais de dano (Vantagem)
    }
    if (elementAdvantage[bossElement] && elementAdvantage[bossElement].includes(playerElement)) {
        return 0.5; // Metade do dano (Desvantagem)
    }
    return 1.0; // Dano Neutro
}

// ==========================================
// 🔄 MANUTENÇÃO AUTOMÁTICA (Agendador)
// ==========================================
async function checkAndGenerateRaids(client, groupId) {
    const now = new Date();

    // 1. Pega o Boss Ativo
    let activeBoss = db.prepare("SELECT * FROM raid_bosses WHERE status = 'active'").get();

    if (activeBoss) {
        // Se o tempo dele acabou, ele expira e ninguém ganha nada (ou ganham prêmio de consolação)
        if (now > new Date(activeBoss.ends_at)) {
            db.prepare("UPDATE raid_bosses SET status = 'expired' WHERE id = ?").run(activeBoss.id);
            if (client && groupId) {
                client.sendMessage(groupId, `⏳ *A RAID EXPIROU!* ⏳\nOs guerreiros não conseguiram derrotar o *${activeBoss.name}* a tempo! Ele recuou... por enquanto.`);
            }
            activeBoss = null;
        }
    }

    // 2. Se não tem Boss Ativo, verifica se tem um Agendado
    if (!activeBoss) {
        let scheduledBoss = db.prepare("SELECT * FROM raid_bosses WHERE status = 'scheduled' ORDER BY starts_at ASC LIMIT 1").get();

        // Se tem um agendado e a hora chegou, acorde-o!
        if (scheduledBoss && now >= new Date(scheduledBoss.starts_at)) {
            db.prepare("UPDATE raid_bosses SET status = 'active' WHERE id = ?").run(scheduledBoss.id);
            if (client && groupId) {
                client.sendMessage(groupId, `🚨 *ALERTA VERMELHO DE RAID!* 🚨\n\nO céus escureceram... *${scheduledBoss.name}* (Elemento: ${scheduledBoss.element}) apareceu!\nHP Total: ${scheduledBoss.hp_max}\n\nUsem o comando *!raid atacar* para ajudar na batalha!`);
            }
        } 
        // Se não tem NEM agendado, gera um para o futuro
        else if (!scheduledBoss) {
            generateNextRaid();
        }
    }
}

function generateNextRaid() {
    const template = BOSS_TEMPLATES[Math.floor(Math.random() * BOSS_TEMPLATES.length)];
    
    // Pega o fim do último boss para calcular 1 mês depois, se não houver, começa amanhã
    const lastBoss = db.prepare("SELECT ends_at FROM raid_bosses ORDER BY id DESC LIMIT 1").get();
    
    let startDate = new Date();
    if (lastBoss) {
        startDate = new Date(lastBoss.ends_at);
        startDate.setDate(startDate.getDate() + RAID_INTERVAL_DAYS);
    } else {
        startDate.setDate(startDate.getDate() + 1); // Se for a 1ª raid do bot, começa amanhã
    }

    let endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + RAID_DURATION_DAYS);

    db.prepare(`
        INSERT INTO raid_bosses (name, element, hp_max, hp_current, status, starts_at, ends_at)
        VALUES (?, ?, ?, ?, 'scheduled', ?, ?)
    `).run(template.name, template.element, template.hp, template.hp, startDate.toISOString(), endDate.toISOString());

    console.log(`[RAID] Próximo Boss agendado: ${template.name} para ${startDate.toISOString()}`);
}

// ==========================================
// ⚔️ SISTEMA DE COMBATE
// ==========================================
function attackRaidBoss(playerId, charSlugs) {
    const activeBoss = db.prepare("SELECT * FROM raid_bosses WHERE status = 'active'").get();
    if (!activeBoss) return { error: "Não há nenhuma Raid ativa no momento!" };

    // Verifica se já atacou hoje
    const todayStr = new Date().toISOString().split('T')[0];
    const hasAttackedToday = db.prepare("SELECT id FROM raid_logs WHERE raid_id = ? AND player_id = ? AND date(attacked_at) = ?").get(activeBoss.id, playerId, todayStr);
    
    if (hasAttackedToday) return { error: "Você está exausto! Você já atacou o Boss hoje. Volte amanhã." };

    // Pega os personagens já usados nesta raid por este jogador
    const pastLogs = db.prepare("SELECT characters_used_json FROM raid_logs WHERE raid_id = ? AND player_id = ?").all(activeBoss.id, playerId);
    let usedChars = [];
    pastLogs.forEach(log => {
        usedChars = usedChars.concat(JSON.parse(log.characters_used_json || '[]'));
    });

    let totalDamage = 0;
    let validatedChars = [];
    const playerDb = db.prepare("SELECT ki_atual FROM players WHERE id = ?").get(playerId);
    const baseKi = playerDb ? Number(playerDb.ki_atual || 1) : 1;

    // Valida os personagens enviados
    for (let slug of charSlugs) {
        if (usedChars.includes(slug)) {
            return { error: `Estratégia inválida! Você já usou o personagem '${slug}' nesta Raid. Escolha outro lutador da sua coleção.` };
        }

        // Verifica se o jogador REALMENTE tem o personagem na box
        const myChar = db.prepare(`
            SELECT 
                c.name, 
                c.element, 
                c.base_damage_mult, 
                c.rarity,
                pc.level,
                pc.duplicates
            FROM player_collection pc
            JOIN character_catalog c ON pc.character_id = c.id
            WHERE pc.player_id = ? AND c.slug = ?
        `).get(playerId, slug);

        if (!myChar) return { error: `Você não possui o personagem '${slug}' na sua Box!` };

        const synergy = getSynergyMultiplier(myChar.element, activeBoss.element);
        const rarityMult = RARITY_RAID_MULTIPLIER[myChar.rarity] || 1.0;

        const level = Number(myChar.level || 1);
        const duplicates = Number(myChar.duplicates || 0);

        // Cada nível aumenta 3%, limitado a 60%
        const levelMult = 1 + Math.min((level - 1) * 0.03, 0.60);

        // Cada duplicata aumenta 5%, limitado a 50%
        const duplicateMult = 1 + Math.min(duplicates * 0.05, 0.50);

        const kiPower = baseKi * 1000;

        const charDamage = Math.floor(
            kiPower *
            myChar.base_damage_mult *
            rarityMult *
            levelMult *
            duplicateMult *
            synergy
        );
        
        totalDamage += charDamage;
        validatedChars.push(slug);
    }

    // Aplica o dano no Boss
    const newHp = Math.max(0, activeBoss.hp_current - totalDamage);
    const isDefeated = newHp === 0;

    // Registra o ataque
    db.prepare(`
        INSERT INTO raid_logs (raid_id, player_id, damage_dealt, characters_used_json, is_last_hit)
        VALUES (?, ?, ?, ?, ?)
    `).run(activeBoss.id, playerId, totalDamage, JSON.stringify(validatedChars), isDefeated ? 1 : 0);

    // Atualiza o HP do Boss
    db.prepare("UPDATE raid_bosses SET hp_current = ? WHERE id = ?").run(newHp, activeBoss.id);

    // Se matou o Boss, distribui recompensas
    if (isDefeated) {
        db.prepare("UPDATE raid_bosses SET status = 'defeated' WHERE id = ?").run(activeBoss.id);
        // generateNextRaid(); <- O checkAndGenerateRaids vai cuidar disso no próximo loop
        return { success: true, damage: totalDamage, defeated: true, bossName: activeBoss.name };
    }

    return { success: true, damage: totalDamage, hpLeft: newHp, bossName: activeBoss.name };
}

module.exports = { checkAndGenerateRaids, attackRaidBoss };
