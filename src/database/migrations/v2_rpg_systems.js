const db = require('../db');

function migrateV2() {
    console.log('[migration] Iniciando migração V2: DragonVerse MMO Expansion...');

    db.exec(`
        -- ==========================================
        -- 1. SISTEMA FORBES (DVI - DragonVerse Index)
        -- ==========================================
        CREATE TABLE IF NOT EXISTS ranked_dvi (
            player_id INTEGER PRIMARY KEY,
            zenies_liquid INTEGER DEFAULT 0,
            savings_bank INTEGER DEFAULT 0,
            collection_value INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            raid_contribution_score INTEGER DEFAULT 0,
            dvi_score REAL DEFAULT 0.0, -- Calculado pela sua fórmula
            last_calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        -- ==========================================
        -- 2. INVENTÁRIO (Cápsulas de Captura, Essências)
        -- ==========================================
        CREATE TABLE IF NOT EXISTS items_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL, -- 'capsule', 'essence', 'material'
            rarity TEXT NOT NULL,
            capture_rate_bonus REAL DEFAULT 0.0, -- Para cápsulas
            price INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS player_inventory (
            player_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 0,
            UNIQUE(player_id, item_id),
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
            FOREIGN KEY(item_id) REFERENCES items_catalog(id) ON DELETE CASCADE
        );

        -- ==========================================
        -- 3. CATÁLOGO DE PERSONAGENS E EVOLUÇÃO
        -- ==========================================
        CREATE TABLE IF NOT EXISTS character_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            rarity TEXT NOT NULL, -- C, U, R, S, SS, SSS, UR, LR, Godly
            element TEXT NOT NULL, -- Fogo, Gelo, Energia, Fisico, Divino
            synergy_tag TEXT, -- 'Guerreiros Z', 'Forças Ginyu', 'Deuses'
            base_damage_mult REAL DEFAULT 1.0,
            passive_ability_id TEXT,
            evolution_target_id INTEGER, -- ID do personagem que ele vira ao evoluir
            evolution_item_id INTEGER, -- ID da essência necessária (ex: Essência Saiyajin)
            FOREIGN KEY(evolution_target_id) REFERENCES character_catalog(id),
            FOREIGN KEY(evolution_item_id) REFERENCES items_catalog(id)
        );

        CREATE TABLE IF NOT EXISTS player_collection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            character_id INTEGER NOT NULL,
            level INTEGER DEFAULT 1,
            duplicates INTEGER DEFAULT 0, -- Útil para fundir ou vender
            captured_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, character_id),
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
            FOREIGN KEY(character_id) REFERENCES character_catalog(id) ON DELETE CASCADE
        );

        -- ==========================================
        -- 4. MERCADO NEGRO (Trocas e Vendas)
        -- ==========================================
        CREATE TABLE IF NOT EXISTS black_market (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id INTEGER NOT NULL,
            character_id INTEGER NOT NULL,
            price_zenies INTEGER NOT NULL,
            status TEXT DEFAULT 'active', -- 'active', 'sold', 'canceled'
            listed_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(seller_id) REFERENCES players(id) ON DELETE CASCADE,
            FOREIGN KEY(character_id) REFERENCES character_catalog(id)
        );

        -- ==========================================
        -- 5. SISTEMA DE RAIDS (Agendamento Automático)
        -- ==========================================
        CREATE TABLE IF NOT EXISTS raid_bosses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            element TEXT NOT NULL,
            hp_max INTEGER NOT NULL,
            hp_current INTEGER NOT NULL,
            status TEXT DEFAULT 'scheduled', -- 'scheduled', 'active', 'defeated', 'expired'
            starts_at TEXT NOT NULL, -- Data de início
            ends_at TEXT NOT NULL -- Duração de 2 semanas
        );

        CREATE TABLE IF NOT EXISTS raid_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raid_id INTEGER NOT NULL,
            player_id INTEGER NOT NULL,
            damage_dealt INTEGER NOT NULL,
            characters_used_json TEXT, -- Os 3 personagens usados no dia
            is_last_hit BOOLEAN DEFAULT 0,
            attacked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(raid_id) REFERENCES raid_bosses(id) ON DELETE CASCADE,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );
    `);

    console.log('✅ Migração V2 concluída: Tabelas de Inventário, Mercado, Raids e DVI prontas!');
}

module.exports = { migrateV2 };
