const {
    BANNER_CONFIG,
    formatZenies,
    getDailyBannerSlots,
    getPullsUsed,
    getPity,
    executePull,
    executeTenPulls,
    resolveDuplicateChoice,
    upSlugLevel,
    getPullHistory,
    ensureDailyBanners
} = require('../services/gachaService');

const db = require('../database/db');

const PITY_LIMIT = 100;

const RARITY_EMOJI = {
    C:      '⚪',
    U:      '🟢',
    R:      '🔵',
    S:      '🟣',
    SS:     '🟡',
    SSS:    '🟠',
    UR:     '🔴',
    LR:     '💎',
    Godly:  '👑',
    Secret: '✨'
};

const BANNER_LABEL = {
    comum:   '🟢 Banner Comum',
    premium: '🟣 Banner Premium',
    divino:  '✨ Banner Divino'
};

function getPlayer(sender) {
    return db.prepare('SELECT * FROM players WHERE phone = ?').get(sender);
}

// ──────────────────────────────────────────────
// .gacha — visão geral
// ──────────────────────────────────────────────
async function cmdGacha(sock, msg, sender) {
    ensureDailyBanners();
    const player = getPlayer(sender);
    if (!player) return sock.sendMessage(msg.key.remoteJid, { text: '❌ Você não está registrado! Use *.register* para começar.' });

    const lines = [
        `🎰 *SISTEMA DE GACHA — DragonVerse RPG*\n`,
        `💰 Seu saldo: *${formatZenies(player.zenies)} Zenies*\n`,
        `📊 *Giros restantes hoje:*`
    ];

    for (const [type, cfg] of Object.entries(BANNER_CONFIG)) {
        const used      = getPullsUsed(player.id, type);
        const remaining = cfg.maxPullsPerDay - used;
        const pity      = getPity(player.id, type);
        lines.push(`  ${BANNER_LABEL[type]}: *${remaining}/${cfg.maxPullsPerDay}* | Pity: ${pity}/${PITY_LIMIT}`);
    }

    lines.push(`\n📌 *Comandos:*`);
    lines.push(`  *.banner* — ver os 3 banners do dia`);
    lines.push(`  *.girar comum | premium | divino* — 1 giro`);
    lines.push(`  *.girar10 comum | premium | divino* — 10x com 10% desconto`);
    lines.push(`  *.up <slug>* — upar nível de um slug`);
    lines.push(`  *.pullhistory* — últimos 20 giros`);

    await sock.sendMessage(msg.key.remoteJid, { text: lines.join('\n') });
}

// ──────────────────────────────────────────────
// .banner — ver banners do dia
// ──────────────────────────────────────────────
async function cmdBanner(sock, msg) {
    ensureDailyBanners();
    const lines = ['🎴 *BANNERS DO DIA*\n'];

    for (const [type, cfg] of Object.entries(BANNER_CONFIG)) {
        const slots = getDailyBannerSlots(type);
        lines.push(`━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`${BANNER_LABEL[type]}`);
        lines.push(`💸 Custo: *${formatZenies(cfg.cost)}* | 🔁 Máx/dia: *${cfg.maxPullsPerDay}* | 🔟 10x = 10% off`);
        lines.push(`🎲 *Chances:* ${Object.entries(cfg.chances).map(([r, c]) => `${r}: ${c}%`).join(' | ')}`);
        lines.push(`\n🃏 *Slots de hoje:*`);
        if (slots.length === 0) {
            lines.push(`  ⚠️ Banner não gerado ainda.`);
        } else {
            slots.forEach((s, i) => {
                const emoji = RARITY_EMOJI[s.rarity] || '❔';
                lines.push(`  ${i + 1}. ${emoji} *${s.reward_name}* [${s.rarity}] ${s.reward_type === 'item' ? '📦' : '🐉'}`);
            });
        }
        lines.push('');
    }

    await sock.sendMessage(msg.key.remoteJid, { text: lines.join('\n') });
}

// ──────────────────────────────────────────────
// .girar <banner> — 1 giro com fake summon
// ──────────────────────────────────────────────
async function cmdGirar(sock, msg, sender, bannerType) {
    if (!BANNER_CONFIG[bannerType]) {
        return sock.sendMessage(msg.key.remoteJid, { text: '❌ Banner inválido. Use: *comum*, *premium* ou *divino*.' });
    }

    const player = getPlayer(sender);
    if (!player) return sock.sendMessage(msg.key.remoteJid, { text: '❌ Você não está registrado!' });

    // Fake summon animation
    await sock.sendMessage(msg.key.remoteJid, { react: { text: '🎰', key: msg.key } });
    await delay(800);
    await sock.sendMessage(msg.key.remoteJid, { text: `✨ *Canalizando energia do ${BANNER_LABEL[bannerType]}...*` });
    await delay(1000);
    await sock.sendMessage(msg.key.remoteJid, { react: { text: '💫', key: msg.key } });
    await delay(1200);
    await sock.sendMessage(msg.key.remoteJid, { react: { text: '🔥', key: msg.key } });
    await delay(800);

    const result = executePull(player.id, bannerType);

    if (!result.success) {
        return sock.sendMessage(msg.key.remoteJid, { text: formatError(result, bannerType) });
    }

    const emoji   = RARITY_EMOJI[result.reward.rarity] || '❔';
    const lines   = [
        `${emoji} *RESULTADO DO GIRO* ${emoji}`,
        ``,
        `🐉 *${result.reward.reward_name}*`,
        `📊 Rank: *${result.reward.rarity}*`,
        `📦 Tipo: ${result.reward.reward_type === 'character' ? 'Personagem' : 'Item'}`,
        result.isPity ? `\n🌟 *PITY ATIVADO!* Você chegou aos ${PITY_LIMIT} giros!` : '',
        result.isDuplicate
            ? `\n⚠️ *Duplicata detectada!* Responda com:\n*1* — Guardar como duplicata (bônus de Raid)\n*2* — Converter em item de UP\n_(você tem 60 segundos)_`
            : `\n✅ *Adicionado à sua Box!*`,
        `\n💰 Custo: ${formatZenies(result.cost)} Zenies`
    ].filter(l => l !== '');

    await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
    await sock.sendMessage(msg.key.remoteJid, { text: lines.join('\n') });

    // Aviso global para LR/Godly/Secret
    await checkGlobalAnnounce(sock, msg, player, result);
}

// ──────────────────────────────────────────────
// .girar10 <banner> — 10 giros com desconto
// ──────────────────────────────────────────────
async function cmdGirar10(sock, msg, sender, bannerType) {
    if (!BANNER_CONFIG[bannerType]) {
        return sock.sendMessage(msg.key.remoteJid, { text: '❌ Banner inválido. Use: *comum*, *premium* ou *divino*.' });
    }

    const player = getPlayer(sender);
    if (!player) return sock.sendMessage(msg.key.remoteJid, { text: '❌ Você não está registrado!' });

    await sock.sendMessage(msg.key.remoteJid, { text: `🎰 *Preparando 10 giros no ${BANNER_LABEL[bannerType]}...*` });
    await delay(1500);
    await sock.sendMessage(msg.key.remoteJid, { react: { text: '⚡', key: msg.key } });
    await delay(1000);

    const result = executeTenPulls(player.id, bannerType);

    if (!result.success) {
        return sock.sendMessage(msg.key.remoteJid, { text: formatError(result, bannerType) });
    }

    const successResults = result.results.filter(r => r.success);
    const best           = successResults.reduce((prev, curr) =>
        rarityOrder(curr.reward.rarity) > rarityOrder(prev.reward.rarity) ? curr : prev
    , successResults[0]);

    const newChars  = successResults.filter(r => !r.isDuplicate && r.reward.reward_type === 'character');
    const dupes     = successResults.filter(r => r.isDuplicate);
    const items     = successResults.filter(r => r.reward.reward_type === 'item');
    const pityHit   = successResults.filter(r => r.isPity);

    const lines = [
        `⚡ *RESULTADO — 10 GIROS* ⚡`,
        ``,
        `🏆 *Melhor pull:* ${RARITY_EMOJI[best.reward.rarity]} *${best.reward.reward_name}* [${best.reward.rarity}]`,
        ``,
        `📋 *Todos os resultados:*`,
        ...successResults.map((r, i) => {
            const e = RARITY_EMOJI[r.reward.rarity] || '❔';
            return `  ${i + 1}. ${e} ${r.reward.reward_name} [${r.reward.rarity}]${r.isDuplicate ? ' ♻️' : ''}`;
        }),
        ``,
        `📊 *Resumo:*`,
        `  🆕 Novos personagens: *${newChars.length}*`,
        `  ♻️ Duplicatas: *${dupes.length}*`,
        `  📦 Itens: *${items.length}*`,
        pityHit.length > 0 ? `  🌟 Pity ativado: *${pityHit.length}x*` : '',
        ``,
        `💰 Total pago: *${formatZenies(result.results.reduce((a, r) => a + (r.cost || 0), 0) - result.discountApplied)} Zenies* (10% off aplicado)`
    ].filter(l => l !== '');

    await sock.sendMessage(msg.key.remoteJid, { text: lines.join('\n') });

    // Avisos globais para raridades altas
    for (const r of successResults) {
        await checkGlobalAnnounce(sock, msg, player, r);
    }

    // Aviso de duplicatas pendentes
    if (dupes.length > 0) {
        await sock.sendMessage(msg.key.remoteJid, {
            text: `⚠️ Você tem *${dupes.length} duplicata(s)* pendente(s)!\nResponda com *1* (duplicata) ou *2* (item de UP) para cada uma.\n_(apenas a mais recente ficará aguardando)_`
        });
    }
}

// ──────────────────────────────────────────────
// Resposta de duplicata (1 ou 2)
// ──────────────────────────────────────────────
async function cmdDuplicateChoice(sock, msg, sender, choice) {
    const player = getPlayer(sender);
    if (!player) return;

    const result = resolveDuplicateChoice(player.id, choice);

    if (!result.success) {
        if (result.reason === 'no_pending') return; // ignora silenciosamente
        return sock.sendMessage(msg.key.remoteJid, { text: '❌ Escolha inválida. Use *1* ou *2*.' });
    }

    if (result.resolved === 'duplicate') {
        await sock.sendMessage(msg.key.remoteJid, { text: '♻️ Registrado como *duplicata*! Isso aumenta seu dano nas Raids.' });
    } else if (result.resolved === 'item') {
        await sock.sendMessage(msg.key.remoteJid, {
            text: `📦 Convertido em *${result.item?.name || 'item de UP'}*! Verifique seu inventário.`
        });
    } else if (result.resolved === 'expired_as_duplicate') {
        await sock.sendMessage(msg.key.remoteJid, {
            text: '⏱️ Tempo expirado. Duplicata registrada automaticamente.'
        });
    }
}

// ──────────────────────────────────────────────
// .up <slug> — upar nível
// ──────────────────────────────────────────────
async function cmdUp(sock, msg, sender, slugArg) {
    if (!slugArg) {
        return sock.sendMessage(msg.key.remoteJid, { text: '❌ Use: *.up <nome ou slug do personagem>*' });
    }

    const player = getPlayer(sender);
    if (!player) return sock.sendMessage(msg.key.remoteJid, { text: '❌ Você não está registrado!' });

    const result = upSlugLevel(player.id, slugArg);

    if (!result.success) {
        const msgs = {
            not_found: `❌ Personagem "*${slugArg}*" não encontrado.`,
            not_owned: `❌ Você não possui esse personagem na Box.`,
            max_level: `⚠️ Seu personagem já está no *nível máximo (50)*!`,
            no_item:   `❌ Você não tem o item necessário para upar este rank.\nVerifique seu inventário com *.inventario*`,
            no_money:  `❌ Zenies insuficientes! Você precisa de *${formatZenies(result.custo)}* e faltam *${formatZenies(result.falta)}* Zenies.`,
            item_not_found: `❌ Item de UP para esse rank não foi encontrado no sistema.`
        };
        return sock.sendMessage(msg.key.remoteJid, { text: msgs[result.reason] || '❌ Erro desconhecido.' });
    }

    const emoji = RARITY_EMOJI[result.rarity] || '📈';
    await sock.sendMessage(msg.key.remoteJid, {
        text: [
            `${emoji} *UP DE NÍVEL — SUCESSO!*`,
            ``,
            `🐉 *${result.charName}* [${result.rarity}]`,
            `📈 Nível: *${result.oldLevel}* → *${result.newLevel}*`,
            `💰 Custo: *${formatZenies(result.cost)} Zenies*`,
            result.newLevel === 50 ? `\n🏆 *NÍVEL MÁXIMO ATINGIDO!*` : ''
        ].filter(l => l !== '').join('\n')
    });
}

// ──────────────────────────────────────────────
// .pullhistory — histórico de giros
// ──────────────────────────────────────────────
async function cmdPullHistory(sock, msg, sender) {
    const player = getPlayer(sender);
    if (!player) return sock.sendMessage(msg.key.remoteJid, { text: '❌ Você não está registrado!' });

    const history = getPullHistory(player.id, 20);
    if (history.length === 0) {
        return sock.sendMessage(msg.key.remoteJid, { text: '📋 Você ainda não fez nenhum giro.' });
    }

    const lines = [`📋 *ÚLTIMOS ${history.length} GIROS*\n`];
    for (const pull of history) {
        const e    = RARITY_EMOJI[pull.rarity] || '❔';
        const date = pull.pulled_at.slice(0, 10);
        const dupe = pull.was_duplicate ? ' ♻️' : '';
        const pity = pull.pity_triggered ? ' 🌟' : '';
        lines.push(`${e} *${pull.reward_name}* [${pull.rarity}] — ${pull.banner_type} — ${date}${dupe}${pity}`);
    }

    await sock.sendMessage(msg.key.remoteJid, { text: lines.join('\n') });
}

// ──────────────────────────────────────────────
// UTILITÁRIOS INTERNOS
// ──────────────────────────────────────────────
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function rarityOrder(rarity) {
    const order = { C: 1, U: 2, R: 3, S: 4, SS: 5, SSS: 6, UR: 7, LR: 8, Godly: 9, Secret: 10 };
    return order[rarity] || 0;
}

function formatError(result, bannerType) {
    const cfg = BANNER_CONFIG[bannerType];
    if (result.reason === 'limit_reached') {
        return `⛔ Você já usou todos os *${cfg.maxPullsPerDay} giros* do ${BANNER_LABEL[bannerType]} hoje!\nVolte amanhã às *00:00*.`;
    }
    if (result.reason === 'no_money') {
        return `❌ Zenies insuficientes!\n💸 Custo: *${formatZenies(result.custo)}*\n📉 Faltam: *${formatZenies(result.falta)} Zenies*`;
    }
    if (result.reason === 'not_enough_pulls') {
        return `⛔ Você só tem *${result.remaining} giro(s)* restantes hoje neste banner. Não é suficiente para o 10x.`;
    }
    if (result.reason === 'no_pool') {
        return `⚠️ Nenhuma recompensa disponível neste banner agora. Tente novamente.`;
    }
    return '❌ Erro inesperado. Tente novamente.';
}

// Aviso global quando sai LR, Godly ou Secret
async function checkGlobalAnnounce(sock, msg, player, result) {
    if (!result.success) return;
    const highRarities = ['LR', 'Godly', 'Secret'];
    if (!highRarities.includes(result.reward.rarity)) return;

    const emoji   = RARITY_EMOJI[result.reward.rarity];
    const announce = [
        `🌍 *ANÚNCIO GLOBAL* 🌍`,
        ``,
        `${emoji} *${player.name}* acabou de conseguir *${result.reward.reward_name}* [${result.reward.rarity}]!`,
        result.reward.rarity === 'Secret' ? `\n🔮 *UM SECRET FOI OBTIDO!* A história foi escrita.` : '',
        result.isPity ? `\n🌟 *Via PITY GARANTIDO!*` : ''
    ].filter(l => l !== '').join('\n');

    // Envia para o grupo atual
    // Para enviar em múltiplos grupos, você deve iterar pelos JIDs com eventos ativos
    await sock.sendMessage(msg.key.remoteJid, { text: announce });
}

// ──────────────────────────────────────────────
// HANDLER PRINCIPAL (registre no seu roteador)
// ──────────────────────────────────────────────
async function handleGachaCommands(sock, msg, sender, text) {
    const lower = text.trim().toLowerCase();

    if (lower === '.gacha')                          return cmdGacha(sock, msg, sender);
    if (lower === '.banner')                         return cmdBanner(sock, msg);
    if (lower === '.pullhistory')                    return cmdPullHistory(sock, msg, sender);

    if (lower.startsWith('.girar10 ')) {
        const banner = lower.replace('.girar10 ', '').trim();
        return cmdGirar10(sock, msg, sender, banner);
    }

    if (lower.startsWith('.girar ')) {
        const banner = lower.replace('.girar ', '').trim();
        return cmdGirar(sock, msg, sender, banner);
    }

    if (lower.startsWith('.up ')) {
        const slug = text.trim().slice(4).trim();
        return cmdUp(sock, msg, sender, slug);
    }

    // Resposta de duplicata (player manda 1 ou 2 solto)
    if (lower === '1' || lower === '2') {
        return cmdDuplicateChoice(sock, msg, sender, lower);
    }
}

module.exports = { handleGachaCommands };
