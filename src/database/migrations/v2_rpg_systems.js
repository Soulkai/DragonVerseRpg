const db = require('../db'); // Ajuste o caminho se necessário para o seu arquivo de banco

function migrateV2() {
    console.log('[migration] Iniciando migração V2 e limpando tabelas antigas...');

    db.exec(`
        -- ==========================================
        -- 🧹 LIMPEZA (DROP) DAS TABELAS ANTIGAS
        -- Isso garante que as novas colunas sejam criadas corretamente
        -- ==========================================
        DROP TABLE IF EXISTS ranked_dvi;
        DROP TABLE IF EXISTS raid_logs;
        DROP TABLE IF EXISTS raid_bosses;
        DROP TABLE IF EXISTS black_market;
        DROP TABLE IF EXISTS player_collection;
        DROP TABLE IF EXISTS character_catalog;
        DROP TABLE IF EXISTS player_inventory;
        DROP TABLE IF EXISTS items_catalog;

        -- ==========================================
        -- 1. SISTEMA FORBES (DVI - DragonVerse Index)
        -- ==========================================
        CREATE TABLE ranked_dvi (
            player_id INTEGER PRIMARY KEY,
            zenies_liquid INTEGER DEFAULT 0,
            savings_bank INTEGER DEFAULT 0,
            collection_value INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            raid_contribution_score INTEGER DEFAULT 0,
            dvi_score REAL DEFAULT 0.0, 
            last_calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        -- ==========================================
        -- 2. INVENTÁRIO (Cápsulas de Captura, Essências)
        -- ==========================================
        CREATE TABLE items_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL, -- 'capsule', 'essence', 'material'
            rarity TEXT NOT NULL,
            capture_rate_bonus REAL DEFAULT 0.0,
            price INTEGER DEFAULT 0
        );

        CREATE TABLE player_inventory (
            player_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            item_name TEXT, -- Garante a leitura textual do item
            quantity INTEGER DEFAULT 0,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, item_id),
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
            FOREIGN KEY(item_id) REFERENCES items_catalog(id) ON DELETE CASCADE
        );

        -- ==========================================
        -- 3. CATÁLOGO DE PERSONAGENS E EVOLUÇÃO (GACHA)
        -- ==========================================
        CREATE TABLE character_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            rarity TEXT NOT NULL, 
            element TEXT NOT NULL, 
            synergy_tag TEXT, 
            base_damage_mult REAL DEFAULT 1.0,
            passive_ability_id TEXT,
            evolution_target_id INTEGER, 
            evolution_item_id INTEGER, 
            FOREIGN KEY(evolution_target_id) REFERENCES character_catalog(id),
            FOREIGN KEY(evolution_item_id) REFERENCES items_catalog(id)
        );

        CREATE TABLE player_collection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            character_id INTEGER NOT NULL,
            level INTEGER DEFAULT 1,
            duplicates INTEGER DEFAULT 0, 
            captured_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(player_id, character_id),
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
            FOREIGN KEY(character_id) REFERENCES character_catalog(id) ON DELETE CASCADE
        );

        -- ==========================================
        -- 4. MERCADO NEGRO (Trocas e Vendas)
        -- ==========================================
        CREATE TABLE black_market (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id INTEGER NOT NULL,
            character_id INTEGER NOT NULL,
            price_zenies INTEGER NOT NULL,
            status TEXT DEFAULT 'active', 
            listed_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(seller_id) REFERENCES players(id) ON DELETE CASCADE,
            FOREIGN KEY(character_id) REFERENCES character_catalog(id) ON DELETE CASCADE
        );

        -- ==========================================
        -- 5. SISTEMA DE RAIDS (Agendamento Automático)
        -- ==========================================
        CREATE TABLE raid_bosses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            element TEXT NOT NULL,
            hp_max INTEGER NOT NULL,
            hp_current INTEGER NOT NULL,
            status TEXT DEFAULT 'scheduled', 
            starts_at TEXT NOT NULL,
            expires_at TEXT NOT NULL -- Corrigido para bater com a verificação do JS
        );

        CREATE TABLE raid_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            raid_id INTEGER NOT NULL,
            player_id INTEGER NOT NULL,
            damage_dealt INTEGER NOT NULL,
            characters_used_json TEXT, 
            is_last_hit BOOLEAN DEFAULT 0,
            attacked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(raid_id) REFERENCES raid_bosses(id) ON DELETE CASCADE,
            FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
        );
    `);

    console.log('✅ Migração V2 concluída e corrigida! Todas as colunas novas foram aplicadas do zero.');
}

module.exports = { migrateV2 };
