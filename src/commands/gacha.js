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

const {
    getOrCreatePlayerFromMessage,
    getWhatsAppIdFromMessage,
    touchPlayerActivity
} = require('../services/playerService');

const PITY_LIMIT = 100;

const RARITY_EMOJI = {
    C: '⚪',
    U: '🟢',
    R: '🔵',
    S: '🟣',
    SS: '🟡',
    SSS: '🟠',
    UR: '🔴',
    LR: '💎',
    Godly: '👑',
    Secret: '✨'
};

const BANNER_LABEL = {
    comum: '🟢 Banner Comum',
    premium: '🟣 Banner Premium',
    divino: '✨ Banner Divino'
};

function getPlayer(message, { createIfMissing = false, touch = true } = {}) {
    if (!message) return null;

    try {
        const player = getOrCreatePlayerFromMessage(message, { touch });
        if (!createIfMissing && !player) return null;
        return player;
    } catch (error) {
        console.error('[gacha] Erro ao obter jogador:', error.message);
        return null;
    }
}

function getChatId(message) {
    return message?.from || null;
}

async function sendText(client, message, text) {
    const chatId = getChatId(message);
    if (!chatId) return;
    await client.sendMessage(chatId, text);
}

async function sendReaction(message, emoji) {
    try {
        await message.react(emoji);
    } catch (_) {}
}

async function cmdGacha(client, message) {
    ensureDailyBanners();
    const player = getPlayer(message, { createIfMissing: true, touch: true });
    if (!player) return sendText(client, message, '❌ Não foi possível localizar seu cadastro agora.');

    const lines = [
        `🎰 *SISTEMA DE GACHA — DragonVerse RPG*`,
        ``,
        `💰 Seu saldo: *${formatZenies(player.zenies)} Zenies*`,
        ``,
        `📊 *Giros restantes hoje:*`
    ];

    for (const [type, cfg] of Object.entries(BANNER_CONFIG)) {
        const used = getPullsUsed(player.id, type);
        const remaining = cfg.maxPullsPerDay - used;
        const pity = getPity(player.id, type);
        lines.push(`  ${BANNER_LABEL[type]}: *${remaining}/${cfg.maxPullsPerDay}* | Pity: ${pity}/${PITY_LIMIT}`);
    }

    lines.push(``);
    lines.push(`📌 *Comandos:*`);
    lines.push(`  *.banner* — ver os 3 banners do dia`);
    lines.push(`  *.girar comum | premium | divino* — 1 giro`);
    lines.push(`  *.girar10 comum | premium | divino* — 10x com 10% desconto`);
    lines.push(`  *.up <slug>* — upar nível de um slug`);
    lines.push(`  *.pullhistory* — últimos 20 giros`);

    await sendText(client, message, lines.join('\n'));
}

async function cmdBanner(client, message) {
    ensureDailyBanners();
    const lines = ['🎴 *BANNERS DO DIA*', ''];

    for (const [type, cfg] of Object.entries(BANNER_CONFIG)) {
        const slots = getDailyBannerSlots(type);
        lines.push(`━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`${BANNER_LABEL[type]}`);
        lines.push(`💸 Custo: *${formatZenies(cfg.cost)}* | 🔁 Máx/dia: *${cfg.maxPullsPerDay}* | 🔟 10x = 10% off`);
        lines.push(`🎲 *Chances:* ${Object.entries(cfg.chances).map(([r, c]) => `${r}: ${c}%`).join(' | ')}`);
        lines.push(``);
        lines.push(`🃏 *Slots de hoje:*`);

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

    await sendText(client, message, lines.join('\n'));
}

async function cmdGirar(client, message, sender, bannerType) {
    if (!BANNER_CONFIG[bannerType]) {
        return sendText(client, message, '❌ Banner inválido. Use: *comum*, *premium* ou *divino*.');
    }

    const player = getPlayer(sender);
    if (!player) return sendText(client, message, '❌ Você não está registrado!');

    await sendReaction(message, '🎰');
    await delay(800);
    await sendText(client, message, `✨ *Canalizando energia do ${BANNER_LABEL[bannerType]}...*`);
    await delay(1000);
    await sendReaction(message, '💫');
    await delay(1200);
    await sendReaction(message, '🔥');
    await delay(800);

    const result = executePull(player.id, bannerType);

    if (!result.success) {
        return sendText(client, message, formatError(result, bannerType));
    }

    const emoji = RARITY_EMOJI[result.reward.rarity] || '❔';
    const lines = [
        `${emoji} *RESULTADO DO GIRO* ${emoji}`,
        ``,
        `🐉 *${result.reward.reward_name}*`,
        `📊 Rank: *${result.reward.rarity}*`,
        `📦 Tipo: ${result.reward.reward_type === 'character' ? 'Personagem' : 'Item'}`,
        result.isPity ? `` : null,
        result.isPity ? `🌟 *PITY ATIVADO!* Você chegou aos ${PITY_LIMIT} giros!` : null,
        result.isDuplicate
            ? `⚠️ *Duplicata detectada!* Responda com:\n*1* — Guardar como duplicata (bônus de Raid)\n*2* — Converter em item de UP\n_(você tem 60 segundos)_`
            : `✅ *Adicionado à sua Box!*`,
        ``,
        `💰 Custo: ${formatZenies(result.cost)} Zenies`
    ].filter(Boolean);

    await sendReaction(message, emoji);
    await sendText(client, message, lines.join('\n'));

    await checkGlobalAnnounce(client, message, player, result);
}

async function cmdGirar10(client, message, sender, bannerType) {
    if (!BANNER_CONFIG[bannerType]) {
        return sendText(client, message, '❌ Banner inválido. Use: *comum*, *premium* ou *divino*.');
    }

    const player = getPlayer(sender);
    if (!player) return sendText(client, message, '❌ Você não está registrado!');

    await sendText(client, message, `🎰 *Preparando 10 giros no ${BANNER_LABEL[bannerType]}...*`);
    await delay(1500);
    await sendReaction(message, '⚡');
    await delay(1000);

    const result = executeTenPulls(player.id, bannerType);

    if (!result.success) {
        return sendText(client, message, formatError(result, bannerType));
    }

    const successResults = result.results.filter(r => r.success);
    if (!successResults.length) {
        return sendText(client, message, '❌ Nenhum giro foi concluído.');
    }

    const best = successResults.reduce((prev, curr) =>
        rarityOrder(curr.reward.rarity) > rarityOrder(prev.reward.rarity) ? curr : prev
    , successResults[0]);

    const newChars = successResults.filter(r => !r.isDuplicate && r.reward.reward_type === 'character');
    const dupes = successResults.filter(r => r.isDuplicate);
    const items = successResults.filter(r => r.reward.reward_type === 'item');
    const pityHit = successResults.filter(r => r.isPity);

    const totalPaid = result.results.reduce((a, r) => a + (r.cost || 0), 0) - (result.discountApplied || 0);

    const lines = [
        `⚡ *RESULTADO — 10 GIROS* ⚡`,
        ``,
        `🏆 *Melhor pull:* ${RARITY_EMOJI[best.reward.rarity] || '❔'} *${best.reward.reward_name}* [${best.reward.rarity}]`,
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
        pityHit.length > 0 ? `  🌟 Pity ativado: *${pityHit.length}x*` : null,
        ``,
        `💰 Total pago: *${formatZenies(totalPaid)} Zenies* (10% off aplicado)`
    ].filter(Boolean);

    await sendText(client, message, lines.join('\n'));

    for (const r of successResults) {
        await checkGlobalAnnounce(client, message, player, r);
    }

    if (dupes.length > 0) {
        await sendText(client, message, `⚠️ Você tem *${dupes.length} duplicata(s)* pendente(s)!\nResponda com *1* (duplicata) ou *2* (item de UP) para cada uma.\n_(apenas a mais recente ficará aguardando)_`);
    }
}

async function cmdDuplicateChoice(client, message, sender, choice) {
    const player = getPlayer(sender);
    if (!player) return;

    const result = resolveDuplicateChoice(player.id, choice);

    if (!result.success) {
        if (result.reason === 'no_pending') return;
        return sendText(client, message, '❌ Escolha inválida. Use *1* ou *2*.');
    }

    if (result.resolved === 'duplicate') {
        await sendText(client, message, '♻️ Registrado como *duplicata*! Isso aumenta seu dano nas Raids.');
    } else if (result.resolved === 'item') {
        await sendText(client, message, `📦 Convertido em *${result.item?.name || 'item de UP'}*! Verifique seu inventário.`);
    } else if (result.resolved === 'expired_as_duplicate') {
        await sendText(client, message, '⏱️ Tempo expirado. Duplicata registrada automaticamente.');
    }
}

async function cmdUp(client, message, sender, slugArg) {
    if (!slugArg) {
        return sendText(client, message, '❌ Use: */up <nome ou slug do personagem>*');
    }

    const player = getPlayer(sender);
    if (!player) return sendText(client, message, '❌ Você não está registrado!');

    const result = upSlugLevel(player.id, slugArg);

    if (!result.success) {
        const msgs = {
            not_found: `❌ Personagem "${slugArg}" não encontrado.`,
            not_owned: `❌ Você não possui esse personagem na Box.`,
            max_level: `⚠️ Seu personagem já está no *nível máximo (50)*!`,
            no_item: `❌ Você não tem o item necessário para upar este rank.\nVerifique seu inventário com */inventario*`,
            no_money: `❌ Zenies insuficientes! Você precisa de *${formatZenies(result.custo)}* e faltam *${formatZenies(result.falta)}* Zenies.`,
            item_not_found: `❌ Item de UP para esse rank não foi encontrado no sistema.`
        };
        return sendText(client, message, msgs[result.reason] || '❌ Erro desconhecido.');
    }

    const emoji = RARITY_EMOJI[result.rarity] || '📈';
    await sendText(client, message, [
        `${emoji} *UP DE NÍVEL — SUCESSO!*`,
        ``,
        `🐉 *${result.charName}* [${result.rarity}]`,
        `📈 Nível: *${result.oldLevel}* → *${result.newLevel}*`,
        `💰 Custo: *${formatZenies(result.cost)} Zenies*`,
        result.newLevel === 50 ? `🏆 *NÍVEL MÁXIMO ATINGIDO!*` : null
    ].filter(Boolean).join('\n'));
}

async function cmdPullHistory(client, message, sender) {
    const player = getPlayer(sender);
    if (!player) return sendText(client, message, '❌ Você não está registrado!');

    const history = getPullHistory(player.id, 20);
    if (history.length === 0) {
        return sendText(client, message, '📋 Você ainda não fez nenhum giro.');
    }

    const lines = [`📋 *ÚLTIMOS ${history.length} GIROS*`, ``];
    for (const pull of history) {
        const e = RARITY_EMOJI[pull.rarity] || '❔';
        const date = String(pull.pulled_at || '').slice(0, 10);
        const dupe = pull.was_duplicate ? ' ♻️' : '';
        const pity = pull.pity_triggered ? ' 🌟' : '';
        lines.push(`${e} *${pull.reward_name}* [${pull.rarity}] — ${pull.banner_type} — ${date}${dupe}${pity}`);
    }

    await sendText(client, message, lines.join('\n'));
}

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

async function checkGlobalAnnounce(client, message, player, result) {
    if (!result.success) return;
    const highRarities = ['LR', 'Godly', 'Secret'];
    if (!highRarities.includes(result.reward.rarity)) return;

    const emoji = RARITY_EMOJI[result.reward.rarity] || '✨';
    const announce = [
        `🌍 *ANÚNCIO GLOBAL* 🌍`,
        ``,
        `${emoji} *${player.name}* acabou de conseguir *${result.reward.reward_name}* [${result.reward.rarity}]!`,
        result.reward.rarity === 'Secret' ? `🔮 *UM SECRET FOI OBTIDO!* A história foi escrita.` : null,
        result.isPity ? `🌟 *Via PITY GARANTIDO!*` : null
    ].filter(Boolean).join('\n');

    await sendText(client, message, announce);
}

async function handleGachaCommands(client, message, command) {
    const lower = String(message?.body || '').trim().toLowerCase();
    const sender = message?.author || message?.from || '';

    if (!lower) return;

    if (lower === '.gacha') return cmdGacha(client, message, sender);
    if (lower === '.banner' || lower === '.banners') return cmdBanner(client, message);
    if (lower === '.pullhistory') return cmdPullHistory(client, message, sender);

    if (lower.startsWith('.girar10 ')) {
        const banner = lower.replace('.girar10 ', '').trim();
        return cmdGirar10(client, message, sender, banner);
    }

    if (lower.startsWith('.girar ')) {
        const banner = lower.replace('.girar ', '').trim();
        return cmdGirar(client, message, sender, banner);
    }

    if (lower.startsWith('.up ')) {
        const slug = String(message.body || '').trim().slice(4).trim();
        return cmdUp(client, message, sender, slug);
    }

    if (lower === '.1' || lower === '.2') {
        return cmdDuplicateChoice(client, message, sender, lower);
    }
}

module.exports = { handleGachaCommands };
