const db = require('../db');

function migrateV2() {
    console.log('[migration] Iniciando migração V2: DragonVerse RPG Systems...');

    db.exec(`
        -- 1. SISTEMA FORBES / DVI
        CREATE TABLE IF NOT EXISTS ranked_dvi (
            player_id INTEGER PRIMARY KEY,
            dvi_score INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            collection_value INTEGER DEFAULT 0,
            raid_contribution INTEGER DEFAULT 0,
            last_calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        -- 2. SISTEMA DE COLECIONÁVEIS (GACHA/CAPTURA)
        CREATE TABLE IF NOT EXISTS character_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            rarity TEXT NOT NULL, -- C, U, R, S, SS, SSS, UR, LR, Godly
            element TEXT NOT NULL, -- Fire, Ice, Energy, Physical, Divine
            base_damage_mult REAL DEFAULT 1.0,
            passive_ability_id TEXT,
            image_path TEXT
        );

        CREATE TABLE IF NOT EXISTS player_collection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            character_catalog_id INTEGER NOT NULL,
            level INTEGER DEFAULT 1,
            captured_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, character_catalog_id),
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
            FOREIGN KEY(character_catalog_id) REFERENCES character_catalog(id) ON DELETE CASCADE
        );

        -- 3. SISTEMA DE RAIDS
        CREATE TABLE IF NOT EXISTS raid_bosses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            element TEXT NOT NULL,
            hp_max INTEGER NOT NULL,
            hp_current INTEGER NOT NULL,
            status TEXT DEFAULT 'active', -- active, defeated, expired
            starts_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS raid_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raid_id INTEGER NOT NULL,
            player_id INTEGER NOT NULL,
            damage_dealt INTEGER NOT NULL,
            characters_used_json TEXT, -- Salva os 3 personagens usados no dia
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(raid_id) REFERENCES raid_bosses(id) ON DELETE CASCADE,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );
    `);

    console.log('✅ Migração V2 concluída com sucesso!');
}

module.exports = { migrateV2 };
