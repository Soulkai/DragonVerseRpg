const db = require('../db');

function migrateV3() {
    console.log('[migration] Iniciando migração V3 — Sistema de Gacha Real...');

    db.exec(`
        -- ==========================================
        -- V3: GACHA REAL — BANNERS, POOL, PITY, HISTÓRICO
        -- ==========================================

        -- Pool base de recompensas do gacha (personagens e itens por banner)
        CREATE TABLE IF NOT EXISTS gacha_pool (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reward_type TEXT NOT NULL,          -- 'character' | 'item'
            reward_ref_id INTEGER NOT NULL,     -- id em character_catalog ou items_catalog
            reward_name TEXT NOT NULL,
            banner_type TEXT NOT NULL,          -- 'comum' | 'premium' | 'divino'
            rarity TEXT NOT NULL,
            is_secret INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1
        );

        -- Banner diário gerado às 00:00 (6 slots por banner)
        CREATE TABLE IF NOT EXISTS gacha_daily_banners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            banner_date TEXT NOT NULL,          -- YYYY-MM-DD
            banner_type TEXT NOT NULL,
            slot_index INTEGER NOT NULL,        -- 1..6
            reward_type TEXT NOT NULL,
            reward_ref_id INTEGER NOT NULL,
            reward_name TEXT NOT NULL,
            rarity TEXT NOT NULL,
            UNIQUE(banner_date, banner_type, slot_index)
        );

        -- Limite diário de giros por player por banner
        CREATE TABLE IF NOT EXISTS gacha_player_daily_limits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            banner_date TEXT NOT NULL,
            banner_type TEXT NOT NULL,
            pulls_used INTEGER DEFAULT 0,
            UNIQUE(player_id, banner_date, banner_type),
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        -- Pity por player por banner (contagem de giros sem top-rarity)
        CREATE TABLE IF NOT EXISTS gacha_player_pity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            banner_type TEXT NOT NULL,
            pity_count INTEGER DEFAULT 0,
            UNIQUE(player_id, banner_type),
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        -- Histórico completo de pulls
        CREATE TABLE IF NOT EXISTS gacha_pull_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            banner_date TEXT NOT NULL,
            banner_type TEXT NOT NULL,
            reward_type TEXT NOT NULL,
            reward_ref_id INTEGER NOT NULL,
            reward_name TEXT NOT NULL,
            rarity TEXT NOT NULL,
            was_duplicate INTEGER DEFAULT 0,
            chosen_duplicate_action TEXT,       -- 'duplicate' | 'item' | null
            cost_paid INTEGER NOT NULL,
            pity_triggered INTEGER DEFAULT 0,
            pulled_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        -- Estado pendente quando sai duplicata (player escolhe o que fazer)
        CREATE TABLE IF NOT EXISTS gacha_pending_choices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            history_id INTEGER NOT NULL,
            character_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            status TEXT DEFAULT 'pending',      -- 'pending' | 'resolved' | 'expired'
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        -- Itens de UP (um por rank)
        -- Adiciona no items_catalog os itens de up caso não existam
        -- (o seed cuida disso, mas garantimos a coluna up_target_rarity)
        -- Caso a coluna já exista, o ALTER TABLE vai falhar silenciosamente
    `);

    // Adiciona coluna up_target_rarity em items_catalog de forma segura
    try {
        db.exec(`ALTER TABLE items_catalog ADD COLUMN up_target_rarity TEXT;`);
        console.log('[migration] Coluna up_target_rarity adicionada em items_catalog.');
    } catch (e) {
        console.log('[migration] up_target_rarity já existe, pulando...');
    }

    console.log('✅ Migração V3 concluída — Sistema de Gacha Real pronto!');
}

module.exports = { migrateV3 };
