const db = require('../database/db');

// ──────────────────────────────────────────────
// CONSTANTES
// ──────────────────────────────────────────────
const BANNER_CONFIG = {
    comum: {
        cost: 20_000_000,
        maxPullsPerDay: 10,
        discountTen: 0.10,
        topRarity: 'S',
        chances: { C: 50, U: 30, R: 19.3, S: 0.7 }
    },
    premium: {
        cost: 500_000_000,
        maxPullsPerDay: 10,
        discountTen: 0.10,
        topRarity: 'UR',
        chances: { SS: 50, SSS: 30, UR: 0.7 } // item SS cobre o restante
    },
    divino: {
        cost: 5_000_000_000,
        maxPullsPerDay: 10,
        discountTen: 0.10,
        topRarity: 'Secret',
        chances: { UR: 50, LR: 30, Godly: 19.99, Secret: 0.01 }
    }
};

const PITY_LIMIT = 100;

const UP_COST = {
    C: 10_000_000, U: 20_000_000, R: 40_000_000, S: 80_000_000,
    SS: 150_000_000, SSS: 250_000_000, UR: 400_000_000,
    LR: 600_000_000, Godly: 800_000_000, Secret: 800_000_000
};

// ──────────────────────────────────────────────
// UTILITÁRIOS
// ──────────────────────────────────────────────
function getTodayDate() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function rollRarity(chances) {
    const rand = Math.random() * 100;
    let accumulated = 0;
    for (const [rarity, weight] of Object.entries(chances)) {
        accumulated += weight;
        if (rand < accumulated) return rarity;
    }
    // fallback para última raridade
    return Object.keys(chances).at(-1);
}

function formatZenies(value) {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(0)}kk`;
    return value.toLocaleString('pt-BR');
}

// ──────────────────────────────────────────────
// GERAÇÃO DO BANNER DIÁRIO
// ──────────────────────────────────────────────
function generateDailyBanners() {
    const today = getTodayDate();
    const banners = ['comum', 'premium', 'divino'];

    for (const bannerType of banners) {
        const existing = db.prepare(
            'SELECT COUNT(*) as cnt FROM gacha_daily_banners WHERE banner_date = ? AND banner_type = ?'
        ).get(today, bannerType);

        if (existing.cnt >= 6) continue; // já gerado hoje

        // limpa slots antigos desse banner
        db.prepare('DELETE FROM gacha_daily_banners WHERE banner_date != ?').run(today);

        const config = BANNER_CONFIG[bannerType];
        const slots = [];

        // sorteia 6 raridades respeitando as chances
        const rarities = [];
        while (rarities.length < 6) {
            const rarity = rollRarity(config.chances);
            rarities.push(rarity);
        }

        // para cada raridade sorteada, pega uma recompensa aleatória da pool
        const insertSlot = db.prepare(`
            INSERT OR IGNORE INTO gacha_daily_banners
            (banner_date, banner_type, slot_index, reward_type, reward_ref_id, reward_name, rarity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        rarities.forEach((rarity, i) => {
            const rewards = db.prepare(`
                SELECT * FROM gacha_pool
                WHERE banner_type = ? AND rarity = ? AND is_active = 1
                ORDER BY RANDOM() LIMIT 1
            `).get(bannerType, rarity);

            if (rewards) {
                insertSlot.run(today, bannerType, i + 1,
                    rewards.reward_type, rewards.reward_ref_id, rewards.reward_name, rarity);
            }
        });

        console.log(`[gacha] Banner ${bannerType} gerado para ${today}.`);
    }
}

// ──────────────────────────────────────────────
// VERIFICAR SE BANNER FOI GERADO HOJE
// ──────────────────────────────────────────────
function ensureDailyBanners() {
    const today = getTodayDate();
    const count = db.prepare(
        'SELECT COUNT(*) as cnt FROM gacha_daily_banners WHERE banner_date = ?'
    ).get(today).cnt;
    if (count < 18) generateDailyBanners(); // 3 banners × 6 slots
}

// ──────────────────────────────────────────────
// BUSCAR SLOTS DO BANNER DO DIA
// ──────────────────────────────────────────────
function getDailyBannerSlots(bannerType) {
    ensureDailyBanners();
    return db.prepare(`
        SELECT * FROM gacha_daily_banners
        WHERE banner_date = ? AND banner_type = ?
        ORDER BY slot_index
    `).all(getTodayDate(), bannerType);
}

// ──────────────────────────────────────────────
// VERIFICAR E ATUALIZAR LIMITE DIÁRIO
// ──────────────────────────────────────────────
function getPullsUsed(playerId, bannerType) {
    const today = getTodayDate();
    const row = db.prepare(`
        SELECT pulls_used FROM gacha_player_daily_limits
        WHERE player_id = ? AND banner_date = ? AND banner_type = ?
    `).get(playerId, today, bannerType);
    return row ? row.pulls_used : 0;
}

function incrementPullsUsed(playerId, bannerType, amount = 1) {
    const today = getTodayDate();
    db.prepare(`
        INSERT INTO gacha_player_daily_limits (player_id, banner_date, banner_type, pulls_used)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(player_id, banner_date, banner_type)
        DO UPDATE SET pulls_used = pulls_used + ?
    `).run(playerId, today, bannerType, amount, amount);
}

// ──────────────────────────────────────────────
// PITY
// ──────────────────────────────────────────────
function getPity(playerId, bannerType) {
    const row = db.prepare(
        'SELECT pity_count FROM gacha_player_pity WHERE player_id = ? AND banner_type = ?'
    ).get(playerId, bannerType);
    return row ? row.pity_count : 0;
}

function incrementPity(playerId, bannerType) {
    db.prepare(`
        INSERT INTO gacha_player_pity (player_id, banner_type, pity_count)
        VALUES (?, ?, 1)
        ON CONFLICT(player_id, banner_type)
        DO UPDATE SET pity_count = pity_count + 1
    `).run(playerId, bannerType);
}

function resetPity(playerId, bannerType) {
    db.prepare(`
        INSERT INTO gacha_player_pity (player_id, banner_type, pity_count)
        VALUES (?, ?, 0)
        ON CONFLICT(player_id, banner_type)
        DO UPDATE SET pity_count = 0
    `).run(playerId, bannerType);
}

// ──────────────────────────────────────────────
// REALIZAR UM PULL
// ──────────────────────────────────────────────
function executePull(playerId, bannerType) {
    ensureDailyBanners();
    const today       = getTodayDate();
    const config      = BANNER_CONFIG[bannerType];
    const pullsUsed   = getPullsUsed(playerId, bannerType);
    const pityCount   = getPity(playerId, bannerType);

    // Verificações
    if (pullsUsed >= config.maxPullsPerDay) {
        return { success: false, reason: 'limit_reached', pullsUsed, max: config.maxPullsPerDay };
    }

    // Verificar saldo
    const player = db.prepare('SELECT zenies FROM players WHERE id = ?').get(playerId);
    if (!player || player.zenies < config.cost) {
        const falta = config.cost - (player?.zenies ?? 0);
        return { success: false, reason: 'no_money', falta, custo: config.cost };
    }

    // Pity garantido?
    let isPity = false;
    let rolledRarity;

    if (pityCount + 1 >= PITY_LIMIT) {
        rolledRarity = config.topRarity;
        isPity = true;
        resetPity(playerId, bannerType);
    } else {
        rolledRarity = rollRarity(config.chances);
        if (rolledRarity === config.topRarity) {
            resetPity(playerId, bannerType);
        } else {
            incrementPity(playerId, bannerType);
        }
    }

    // Sorteia recompensa do slot correspondente do dia
    const slots = db.prepare(`
        SELECT * FROM gacha_daily_banners
        WHERE banner_date = ? AND banner_type = ? AND rarity = ?
        ORDER BY RANDOM() LIMIT 1
    `).get(today, bannerType, rolledRarity);

    if (!slots) {
        // fallback: qualquer slot do banner de hoje
        const fallback = db.prepare(`
            SELECT * FROM gacha_daily_banners
            WHERE banner_date = ? AND banner_type = ?
            ORDER BY RANDOM() LIMIT 1
        `).get(today, bannerType);

        if (!fallback) return { success: false, reason: 'no_pool' };
        return doReward(playerId, bannerType, fallback, config.cost, isPity);
    }

    return doReward(playerId, bannerType, slots, config.cost, isPity);
}

// ──────────────────────────────────────────────
// PROCESSAR RECOMPENSA
// ──────────────────────────────────────────────
function doReward(playerId, bannerType, slot, cost, isPity) {
    // Desconta zenies
    db.prepare('UPDATE players SET zenies = zenies - ? WHERE id = ?').run(cost, playerId);
    incrementPullsUsed(playerId, bannerType);

    let isDuplicate = false;

    if (slot.reward_type === 'character') {
        const existing = db.prepare(
            'SELECT id FROM player_collection WHERE player_id = ? AND character_id = ?'
        ).get(playerId, slot.reward_ref_id);

        if (existing) {
            isDuplicate = true;
        } else {
            db.prepare(`
                INSERT INTO player_collection (player_id, character_id, level)
                VALUES (?, ?, 1)
            `).run(playerId, slot.reward_ref_id);
        }
    } else {
        // item vai direto para o inventário
        db.prepare(`
            INSERT INTO player_inventory (player_id, item_id, item_name, quantity)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(player_id, item_id)
            DO UPDATE SET quantity = quantity + 1
        `).run(playerId, slot.reward_ref_id, slot.reward_name);
    }

    // Salva histórico
    const historyId = db.prepare(`
        INSERT INTO gacha_pull_history
        (player_id, banner_date, banner_type, reward_type, reward_ref_id, reward_name, rarity,
         was_duplicate, cost_paid, pity_triggered)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        playerId, getTodayDate(), bannerType,
        slot.reward_type, slot.reward_ref_id, slot.reward_name, slot.rarity,
        isDuplicate ? 1 : 0, cost, isPity ? 1 : 0
    ).lastInsertRowid;

    // Se duplicata de personagem, cria escolha pendente
    if (isDuplicate && slot.reward_type === 'character') {
        const expiresAt = new Date(Date.now() + 60_000).toISOString();
        db.prepare(`
            INSERT INTO gacha_pending_choices (player_id, history_id, character_id, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(playerId, historyId, slot.reward_ref_id, expiresAt);
    }

    return {
        success: true,
        reward: slot,
        isDuplicate,
        isPity,
        historyId,
        cost
    };
}

// ──────────────────────────────────────────────
// GIRAR 10X
// ──────────────────────────────────────────────
function executeTenPulls(playerId, bannerType) {
    const config    = BANNER_CONFIG[bannerType];
    const pullsUsed = getPullsUsed(playerId, bannerType);
    const remaining = config.maxPullsPerDay - pullsUsed;

    if (remaining < 10) {
        return { success: false, reason: 'not_enough_pulls', remaining };
    }

    const totalCost    = config.cost * 10;
    const discountedCost = Math.floor(totalCost * (1 - config.discountTen));

    const player = db.prepare('SELECT zenies FROM players WHERE id = ?').get(playerId);
    if (!player || player.zenies < discountedCost) {
        const falta = discountedCost - (player?.zenies ?? 0);
        return { success: false, reason: 'no_money', falta, custo: discountedCost };
    }

    // Repõe o saldo e deixa o executePull descontar 1 por vez
    // Para simplificar: restitui desconto ao final
    const discount = totalCost - discountedCost;

    const results = [];
    for (let i = 0; i < 10; i++) {
        const r = executePull(playerId, bannerType);
        results.push(r);
        if (!r.success) break;
    }

    // Aplica o desconto de volta no saldo
    if (results.filter(r => r.success).length === 10) {
        db.prepare('UPDATE players SET zenies = zenies + ? WHERE id = ?').run(discount, playerId);
    }

    return { success: true, results, discountApplied: discount };
}

// ──────────────────────────────────────────────
// RESOLVER ESCOLHA DE DUPLICATA
// ──────────────────────────────────────────────
function resolveDuplicateChoice(playerId, choice) {
    const pending = db.prepare(`
        SELECT p.*, h.rarity
        FROM gacha_pending_choices p
        JOIN gacha_pull_history h ON h.id = p.history_id
        WHERE p.player_id = ? AND p.status = 'pending'
        ORDER BY p.id DESC
        LIMIT 1
    `).get(playerId);

    if (!pending) return { success: false, reason: 'no_pending' };

    const expired = new Date(pending.expires_at) < new Date();
    if (expired) {
        db.prepare(`
            UPDATE gacha_pending_choices
            SET status = 'expired'
            WHERE id = ?
        `).run(pending.id);

        db.prepare(`
            UPDATE player_collection
            SET duplicates = duplicates + 1
            WHERE player_id = ? AND character_id = ?
        `).run(playerId, pending.character_id);

        db.prepare(`
            UPDATE gacha_pull_history
            SET chosen_duplicate_action = 'duplicate'
            WHERE id = ?
        `).run(pending.history_id);

        return { success: true, resolved: 'expired_as_duplicate' };
    }

    if (choice === '1' || choice === 'duplicate') {
        db.prepare(`
            UPDATE player_collection
            SET duplicates = duplicates + 1
            WHERE player_id = ? AND character_id = ?
        `).run(playerId, pending.character_id);

        db.prepare(`
            UPDATE gacha_pending_choices
            SET status = 'resolved'
            WHERE id = ?
        `).run(pending.id);

        db.prepare(`
            UPDATE gacha_pull_history
            SET chosen_duplicate_action = 'duplicate'
            WHERE id = ?
        `).run(pending.history_id);

        return { success: true, resolved: 'duplicate' };
    }

    if (choice === '2' || choice === 'item') {
        const slugMap = {
            C: 'up-level-c',
            U: 'up-level-u',
            R: 'up-level-r',
            S: 'up-level-s',
            SS: 'up-level-ss',
            SSS: 'up-level-sss',
            UR: 'up-level-ur',
            LR: 'up-level-lr',
            Godly: 'up-level-godly'
        };

        const itemSlug = slugMap[pending.rarity];
        if (!itemSlug) {
            return { success: false, reason: 'item_not_found' };
        }

        const item = db.prepare(`
            SELECT id, name
            FROM items_catalog
            WHERE slug = ?
            LIMIT 1
        `).get(itemSlug);

        if (!item || !item.id) {
            return { success: false, reason: 'item_not_found' };
        }

        db.prepare(`
            INSERT INTO player_inventory (player_id, item_id, item_name, quantity, updated_at)
            VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(player_id, item_id) DO UPDATE SET
                quantity = quantity + 1,
                item_name = excluded.item_name,
                updated_at = CURRENT_TIMESTAMP
        `).run(playerId, item.id, item.name);

        db.prepare(`
            UPDATE gacha_pending_choices
            SET status = 'resolved'
            WHERE id = ?
        `).run(pending.id);

        db.prepare(`
            UPDATE gacha_pull_history
            SET chosen_duplicate_action = 'item'
            WHERE id = ?
        `).run(pending.history_id);

        return {
            success: true,
            resolved: 'item',
            item: {
                id: item.id,
                name: item.name
            }
        };
    }

    return { success: false, reason: 'invalid_choice' };
}
// ──────────────────────────────────────────────
// SISTEMA DE UP DE NÍVEL
// ──────────────────────────────────────────────
function upSlugLevel(playerId, slugName) {
    const char = db.prepare('SELECT id, name, rarity FROM character_catalog WHERE slug = ? OR LOWER(name) = LOWER(?)').get(slugName, slugName);
    if (!char) return { success: false, reason: 'not_found' };

    const pc = db.prepare(
        'SELECT id, level FROM player_collection WHERE player_id = ? AND character_id = ?'
    ).get(playerId, char.id);

    if (!pc) return { success: false, reason: 'not_owned' };
    if (pc.level >= 50) return { success: false, reason: 'max_level' };

    const itemSlug  = `up-level-${char.rarity.toLowerCase()}`;
    const upItem    = db.prepare('SELECT id FROM items_catalog WHERE slug = ?').get(itemSlug);
    if (!upItem) return { success: false, reason: 'item_not_found' };

    const inv = db.prepare(
        'SELECT quantity FROM player_inventory WHERE player_id = ? AND item_id = ?'
    ).get(playerId, upItem.id);

    if (!inv || inv.quantity < 1) return { success: false, reason: 'no_item' };

    // Custo em Zenies (escala leve por level)
    const baseCost = UP_COST[char.rarity] ?? 50_000_000;
    const totalCost = Math.floor(baseCost * (1 + (pc.level - 1) * 0.03));

    const player = db.prepare('SELECT zenies FROM players WHERE id = ?').get(playerId);
    if (!player || player.zenies < totalCost) {
        return { success: false, reason: 'no_money', falta: totalCost - player.zenies, custo: totalCost };
    }

    // Executa UP
    db.prepare('UPDATE players SET zenies = zenies - ? WHERE id = ?').run(totalCost, playerId);
    db.prepare('UPDATE player_inventory SET quantity = quantity - 1 WHERE player_id = ? AND item_id = ?').run(playerId, upItem.id);
    db.prepare('UPDATE player_collection SET level = level + 1 WHERE id = ?').run(pc.id);

    return {
        success: true,
        charName: char.name,
        rarity: char.rarity,
        oldLevel: pc.level,
        newLevel: pc.level + 1,
        cost: totalCost
    };
}

// ──────────────────────────────────────────────
// HISTÓRICO DE PULLS DO PLAYER
// ──────────────────────────────────────────────
function getPullHistory(playerId, limit = 20) {
    return db.prepare(`
        SELECT * FROM gacha_pull_history
        WHERE player_id = ?
        ORDER BY pulled_at DESC
        LIMIT ?
    `).all(playerId, limit);
}

// ──────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────
module.exports = {
    BANNER_CONFIG,
    UP_COST,
    formatZenies,
    generateDailyBanners,
    ensureDailyBanners,
    getDailyBannerSlots,
    getPullsUsed,
    getPity,
    executePull,
    executeTenPulls,
    resolveDuplicateChoice,
    upSlugLevel,
    getPullHistory
};
