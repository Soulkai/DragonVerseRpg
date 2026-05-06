const db = require('./db');
const personagensUniverso2 = require('../data/personagensUniverso2');
const { slugify } = require('../utils/text');
const { STARTING_ZENIES, calculateTotalSalary, isSupremeRoleId } = require('../data/roles');

function columnExists(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function addColumnIfMissing(tableName, columnName, definition) {
  if (!columnExists(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS universes (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      welcome_text TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      universe_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0,
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(universe_id, slug),
      FOREIGN KEY(universe_id) REFERENCES universes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whatsapp_id TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      display_name TEXT,
      ki_atual INTEGER NOT NULL DEFAULT 1,
      zenies INTEGER NOT NULL DEFAULT 100000000,
      deposito INTEGER NOT NULL DEFAULT 0,
      cargo_id TEXT NOT NULL DEFAULT 'L.I',
      cargo TEXT NOT NULL DEFAULT 'Lutador Iniciante',
      trabalho_id TEXT,
      trabalho TEXT NOT NULL DEFAULT 'Nenhum',
      salario INTEGER NOT NULL DEFAULT 1000000,
      last_active_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_salary_at TEXT,
      last_deposit_at TEXT,
      last_deposit_interest_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS character_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL UNIQUE,
      universe_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      claim_type TEXT NOT NULL DEFAULT 'player',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(universe_id) REFERENCES universes(id) ON DELETE CASCADE,
      FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_player_character_by_universe
    ON character_claims(universe_id, character_id)
    WHERE claim_type = 'player';

    CREATE INDEX IF NOT EXISTS idx_supreme_character_lookup
    ON character_claims(character_id)
    WHERE claim_type = 'supremo';

    CREATE TABLE IF NOT EXISTS rescue_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      universe_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      is_universal INTEGER NOT NULL DEFAULT 0,
      character_slug TEXT,
      character_name TEXT,
      created_by TEXT NOT NULL,
      redeemed_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      used_at TEXT,
      FOREIGN KEY(universe_id) REFERENCES universes(id) ON DELETE CASCADE,
      FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, item_id),
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      purchase_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transfer_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_player_id INTEGER NOT NULL,
      to_player_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(from_player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(to_player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transfer_history_from
    ON transfer_history(from_player_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_transfer_history_to
    ON transfer_history(to_player_id, created_at);

    CREATE TABLE IF NOT EXISTS event_daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      date_key TEXT NOT NULL,
      manual_participations INTEGER NOT NULL DEFAULT 0,
      manual_wins INTEGER NOT NULL DEFAULT 0,
      manual_reward_total INTEGER NOT NULL DEFAULT 0,
      emoji_claims INTEGER NOT NULL DEFAULT 0,
      emoji_reward_total INTEGER NOT NULL DEFAULT 0,
      auto_quiz_wins INTEGER NOT NULL DEFAULT 0,
      auto_quiz_reward_total INTEGER NOT NULL DEFAULT 0,
      slot_plays INTEGER NOT NULL DEFAULT 0,
      slot_bet_total INTEGER NOT NULL DEFAULT 0,
      slot_reward_total INTEGER NOT NULL DEFAULT 0,
      slot_loss_total INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, date_key),
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_chats (
      chat_id TEXT PRIMARY KEY,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      enabled_by TEXT,
      last_emoji_at TEXT,
      last_auto_quiz_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_chat_daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      emoji_sent INTEGER NOT NULL DEFAULT 0,
      auto_quiz_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(chat_id, date_key),
      FOREIGN KEY(chat_id) REFERENCES event_chats(chat_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      player_id INTEGER,
      event_type TEXT NOT NULL,
      state_json TEXT,
      answer TEXT,
      reward INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      claimed_by_player_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(claimed_by_player_id) REFERENCES players(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_active_events_lookup
    ON active_events(chat_id, event_type, status);

    CREATE INDEX IF NOT EXISTS idx_active_events_player
    ON active_events(player_id, status);
  `);


  createDragonVerseExtraTables();
  seedCharacterTemplates();
  patchExistingBoxOpeningsTable();
  patchExistingPlayersTable();
  patchExistingEventDailyStatsTable();
  patchExistingRescueCodesTable();
  patchCharacterClaimIndexes();
  syncSupremeCharacterClaims();
  seedUniverse2();
}



function patchExistingBoxOpeningsTable() {
  addColumnIfMissing('box_openings', 'date_key', 'TEXT');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_box_openings_daily
    ON box_openings(player_id, date_key);
  `);
}

function createDragonVerseExtraTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS character_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      is_locked INTEGER NOT NULL DEFAULT 0,
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_streaks (
      player_id INTEGER PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_presence_date TEXT,
      rewarded_thresholds TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS referral_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recruit_id INTEGER NOT NULL UNIQUE,
      recruiter_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      bonus_expires_at TEXT NOT NULL,
      total_bonus_paid INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(recruit_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(recruiter_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generic_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      value INTEGER NOT NULL,
      max_redemptions INTEGER NOT NULL,
      redeemed_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS generic_code_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(code_id, player_id),
      FOREIGN KEY(code_id) REFERENCES generic_codes(id) ON DELETE CASCADE,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_discounts (
      player_id INTEGER PRIMARY KEY,
      percent INTEGER NOT NULL DEFAULT 0,
      uses INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS box_openings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      box_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      money_reward INTEGER NOT NULL DEFAULT 0,
      collectible_id TEXT,
      collectible_name TEXT,
      date_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_collectibles (
      player_id INTEGER NOT NULL,
      collectible_id TEXT NOT NULL,
      collectible_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      completed_sets INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(player_id, collectible_id),
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      entry_fee INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      current_round INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      winner_player_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY(winner_player_id) REFERENCES players(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tournament_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_bye_round INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tournament_id, player_id),
      FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tournament_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      player1_id INTEGER NOT NULL,
      player2_id INTEGER,
      winner_player_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      is_bye INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      UNIQUE(tournament_id, round_number, match_number),
      FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY(player1_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(player2_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(winner_player_id) REFERENCES players(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tournaments_lookup ON tournaments(chat_id, status);
    CREATE INDEX IF NOT EXISTS idx_tournament_entries_lookup ON tournament_entries(tournament_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_tournament_matches_lookup ON tournament_matches(tournament_id, round_number, status);

    CREATE TABLE IF NOT EXISTS bounty_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      universe_id INTEGER NOT NULL,
      target_player_id INTEGER NOT NULL,
      target_character_name TEXT,
      date_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      target_wins INTEGER NOT NULL DEFAULT 0,
      hunter_wins INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      UNIQUE(chat_id, date_key),
      FOREIGN KEY(target_player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bounty_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bounty_id INTEGER NOT NULL,
      winner_type TEXT NOT NULL,
      winner_player_id INTEGER,
      reward INTEGER NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(bounty_id) REFERENCES bounty_events(id) ON DELETE CASCADE,
      FOREIGN KEY(winner_player_id) REFERENCES players(id) ON DELETE SET NULL
    );



    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS economy_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER,
      related_player_id INTEGER,
      description TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(related_player_id) REFERENCES players(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_economy_ledger_player
    ON economy_ledger(player_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_economy_ledger_direction
    ON economy_ledger(player_id, direction, created_at);

    CREATE TABLE IF NOT EXISTS ranked_profiles (
      player_id INTEGER PRIMARY KEY,
      pr INTEGER NOT NULL DEFAULT 0,
      pc INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      wo_wins INTEGER NOT NULL DEFAULT 0,
      wo_losses INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ranked_fights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      fight_code TEXT UNIQUE,
      challenger_id INTEGER NOT NULL,
      challenged_id INTEGER NOT NULL,
      winner_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      result_type TEXT,
      date_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accept_expires_at TEXT,
      accepted_at TEXT,
      fight_expires_at TEXT,
      finished_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(challenger_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(challenged_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(winner_id) REFERENCES players(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ranked_fights_lookup ON ranked_fights(status, challenger_id, challenged_id);
    CREATE INDEX IF NOT EXISTS idx_ranked_fights_date ON ranked_fights(date_key);

    CREATE TABLE IF NOT EXISTS zmarket_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      price_pc INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_event_daily_stats_date ON event_daily_stats(date_key);
    CREATE INDEX IF NOT EXISTS idx_player_referrals_recruit ON player_referrals(recruit_id, bonus_expires_at);
    CREATE INDEX IF NOT EXISTS idx_bounty_events_lookup ON bounty_events(chat_id, date_key, status);
  `);
}


function seedCharacterTemplates() {
  const insertOrUpdateTemplate = db.prepare(`
    INSERT INTO character_templates (name, slug, is_locked, image_path)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      is_locked = excluded.is_locked,
      image_path = COALESCE(character_templates.image_path, excluded.image_path),
      updated_at = CURRENT_TIMESTAMP
  `);

  const insertTemplateIfMissing = db.prepare(`
    INSERT INTO character_templates (name, slug, is_locked, image_path)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO NOTHING
  `);

  const existingCount = db.prepare('SELECT COUNT(*) AS total FROM characters').get().total || 0;

  const transaction = db.transaction(() => {
    if (existingCount > 0) {
      const existingCharacters = db.prepare(`
        SELECT name, slug, MAX(is_locked) AS is_locked, image_path
        FROM characters
        GROUP BY slug
        ORDER BY name COLLATE NOCASE ASC
      `).all();

      for (const character of existingCharacters) {
        insertOrUpdateTemplate.run(
          character.name,
          character.slug,
          character.is_locked ? 1 : 0,
          character.image_path || `assets/personagens/${character.slug}.png`
        );
      }
      return;
    }

    for (const character of personagensUniverso2) {
      const slug = slugify(character.name);
      insertTemplateIfMissing.run(
        character.name,
        slug,
        character.locked ? 1 : 0,
        `assets/personagens/${slug}.png`
      );
    }
  });

  transaction();
}

function getCharacterTemplates() {
  const templates = db.prepare(`
    SELECT name, slug, is_locked, image_path
    FROM character_templates
    ORDER BY name COLLATE NOCASE ASC
  `).all();

  if (templates.length > 0) {
    return templates.map((item) => ({
      name: item.name,
      slug: item.slug,
      locked: Boolean(item.is_locked),
      image_path: item.image_path,
    }));
  }

  return personagensUniverso2.map((item) => ({
    name: item.name,
    slug: slugify(item.name),
    locked: Boolean(item.locked),
    image_path: `assets/personagens/${slugify(item.name)}.png`,
  }));
}

function patchCharacterClaimIndexes() {
  // Corrige bancos antigos sem apagar dados.
  // Algumas versões antigas criaram UNIQUE(universe_id, character_id) dentro da própria tabela,
  // e esse tipo de UNIQUE não pode ser removido com DROP INDEX.
  // Por isso recriamos a tabela preservando os dados e sem esse bloqueio global.
  rebuildCharacterClaimsTableIfNeeded();

  db.exec(`
    DROP INDEX IF EXISTS idx_unique_supreme_character;
    DROP INDEX IF EXISTS idx_unique_player_character_by_universe;
    DROP INDEX IF EXISTS idx_supreme_character_lookup;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_player_character_by_universe
    ON character_claims(universe_id, character_id)
    WHERE claim_type = 'player';

    CREATE INDEX IF NOT EXISTS idx_supreme_character_lookup
    ON character_claims(character_id)
    WHERE claim_type = 'supremo';
  `);
}

function rebuildCharacterClaimsTableIfNeeded() {
  const table = db.prepare(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'character_claims'
  `).get();

  if (!table) return;

  const tableSql = String(table.sql || '').toLowerCase();
  const hasGlobalUnique =
    tableSql.includes('unique(universe_id, character_id)') ||
    tableSql.includes('unique (universe_id, character_id)');

  // Mesmo quando não há UNIQUE no corpo da tabela, a recriação é segura e normaliza bancos
  // que passaram por várias versões do bot. Ela preserva IDs, players e personagens.
  const shouldRebuild = hasGlobalUnique || !tableSql.includes('claim_type');
  if (!shouldRebuild) return;

  db.exec('PRAGMA foreign_keys = OFF;');
  const transaction = db.transaction(() => {
    db.exec(`
      ALTER TABLE character_claims RENAME TO character_claims_old_migration;

      CREATE TABLE character_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL UNIQUE,
        universe_id INTEGER NOT NULL,
        character_id INTEGER NOT NULL,
        claim_type TEXT NOT NULL DEFAULT 'player',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY(universe_id) REFERENCES universes(id) ON DELETE CASCADE,
        FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
      );
    `);

    const oldColumns = db.prepare('PRAGMA table_info(character_claims_old_migration)').all().map((column) => column.name);
    const hasClaimType = oldColumns.includes('claim_type');

    db.exec(`
      INSERT OR IGNORE INTO character_claims (
        id,
        player_id,
        universe_id,
        character_id,
        claim_type,
        created_at
      )
      SELECT
        id,
        player_id,
        universe_id,
        character_id,
        ${hasClaimType ? "COALESCE(NULLIF(claim_type, ''), 'player')" : "'player'"} AS claim_type,
        COALESCE(created_at, CURRENT_TIMESTAMP)
      FROM character_claims_old_migration
      ORDER BY id ASC;

      DROP TABLE character_claims_old_migration;
    `);
  });

  transaction();
  db.exec('PRAGMA foreign_keys = ON;');
}

function syncSupremeCharacterClaims() {
  const updateClaim = db.prepare(`
    UPDATE character_claims
    SET claim_type = ?
    WHERE id = ?
  `);

  const claims = db.prepare(`
    SELECT
      cc.id,
      cc.claim_type,
      cc.universe_id,
      cc.character_id,
      cc.player_id,
      p.cargo_id
    FROM character_claims cc
    JOIN players p ON p.id = cc.player_id
    ORDER BY cc.id ASC
  `).all();

  const transaction = db.transaction(() => {
    // Primeiro: cargos supremos nunca ocupam personagem comum.
    for (const claim of claims) {
      if (isSupremeRoleId(claim.cargo_id) && claim.claim_type !== 'supremo') {
        updateClaim.run('supremo', claim.id);
      }
    }

    // Segundo: jogadores comuns só voltam a ocupar personagem se isso não causar conflito
    // com outro claim comum já existente no mesmo universo/personagem.
    const refreshedClaims = db.prepare(`
      SELECT
        cc.id,
        cc.claim_type,
        cc.universe_id,
        cc.character_id,
        cc.player_id,
        p.cargo_id
      FROM character_claims cc
      JOIN players p ON p.id = cc.player_id
      ORDER BY cc.id ASC
    `).all();

    const hasPlayerClaimConflict = db.prepare(`
      SELECT id
      FROM character_claims
      WHERE universe_id = ?
        AND character_id = ?
        AND claim_type = 'player'
        AND id <> ?
      LIMIT 1
    `);

    for (const claim of refreshedClaims) {
      if (isSupremeRoleId(claim.cargo_id)) continue;
      if (claim.claim_type === 'player') continue;

      const conflict = hasPlayerClaimConflict.get(claim.universe_id, claim.character_id, claim.id);
      if (!conflict) {
        updateClaim.run('player', claim.id);
      }
      // Se há conflito, mantemos como 'supremo' para não derrubar a inicialização
      // nem apagar dados do jogador. O admin pode resolver depois com /trocarpersonagem
      // ou /deleteplayer, se quiser limpar o caso manualmente.
    }
  });

  transaction();
}

function patchExistingEventDailyStatsTable() {
  addColumnIfMissing('event_daily_stats', 'slot_plays', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('event_daily_stats', 'slot_bet_total', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('event_daily_stats', 'slot_reward_total', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('event_daily_stats', 'slot_loss_total', 'INTEGER NOT NULL DEFAULT 0');
}


function patchExistingRescueCodesTable() {
  addColumnIfMissing('rescue_codes', 'is_universal', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('rescue_codes', 'character_slug', 'TEXT');
  addColumnIfMissing('rescue_codes', 'character_name', 'TEXT');

  db.prepare(`
    UPDATE rescue_codes
    SET character_slug = (
      SELECT c.slug
      FROM characters c
      WHERE c.id = rescue_codes.character_id
    )
    WHERE character_slug IS NULL OR character_slug = ''
  `).run();

  db.prepare(`
    UPDATE rescue_codes
    SET character_name = (
      SELECT c.name
      FROM characters c
      WHERE c.id = rescue_codes.character_id
    )
    WHERE character_name IS NULL OR character_name = ''
  `).run();

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rescue_codes_universal_lookup
    ON rescue_codes(code, is_universal, character_slug);

    CREATE INDEX IF NOT EXISTS idx_rescue_codes_specific_lookup
    ON rescue_codes(code, universe_id, character_id);
  `);
}

function patchExistingPlayersTable() {
  addColumnIfMissing('players', 'cargo_id', "TEXT NOT NULL DEFAULT 'L.I'");
  addColumnIfMissing('players', 'trabalho_id', 'TEXT');
  addColumnIfMissing('players', 'last_active_at', 'TEXT');
  addColumnIfMissing('players', 'last_salary_at', 'TEXT');
  addColumnIfMissing('players', 'last_deposit_at', 'TEXT');
  addColumnIfMissing('players', 'last_deposit_interest_at', 'TEXT');

  db.prepare(`
    UPDATE players
    SET cargo = 'Lutador Iniciante'
    WHERE cargo IS NULL OR cargo = '' OR cargo = 'Guerreiro'
  `).run();

  db.prepare(`
    UPDATE players
    SET cargo_id = 'L.I'
    WHERE cargo_id IS NULL OR cargo_id = ''
  `).run();

  db.prepare(`
    UPDATE players
    SET trabalho = 'Nenhum'
    WHERE trabalho IS NULL OR trabalho = ''
  `).run();

  db.prepare(`
    UPDATE players
    SET salario = ?
    WHERE salario IS NULL OR salario = 0
  `).run(calculateTotalSalary('L.I'));

  db.prepare(`
    UPDATE players
    SET ki_atual = 1
    WHERE ki_atual IS NULL OR ki_atual <= 0 OR ki_atual = 1000
  `).run();

  db.prepare(`
    UPDATE players
    SET zenies = ?
    WHERE zenies IS NULL OR zenies < 0
  `).run(STARTING_ZENIES);

  db.prepare(`
    UPDATE players
    SET last_active_at = COALESCE(last_active_at, updated_at, created_at, CURRENT_TIMESTAMP),
        last_salary_at = COALESCE(last_salary_at, created_at, CURRENT_TIMESTAMP),
        last_deposit_interest_at = CASE
          WHEN deposito > 0 THEN COALESCE(last_deposit_interest_at, created_at, CURRENT_TIMESTAMP)
          ELSE last_deposit_interest_at
        END,
        last_deposit_at = CASE
          WHEN deposito > 0 THEN COALESCE(last_deposit_at, last_deposit_interest_at, created_at, CURRENT_TIMESTAMP)
          ELSE last_deposit_at
        END
  `).run();
}

function seedUniverse2() {
  const welcome = '==>> Bem-vindo ao Universo 2 DragonVerse, aqui você irá escolher seu personagem e logo em seguida será treinado para se juntar à batalha. <<==';
  createUniverseWithCharacters(2, 'Universo 2', welcome, false);
}

function createUniverseWithCharacters(universeId, name = null, welcomeText = null, failIfExists = true) {
  const exists = db.prepare('SELECT id FROM universes WHERE id = ?').get(universeId);
  if (exists && failIfExists) {
    return { ok: false, message: `O Universo ${universeId} já existe.` };
  }

  const universeName = name || `Universo ${universeId}`;
  const welcome = welcomeText || `==>> Bem-vindo ao Universo ${universeId} DragonVerse, aqui você irá escolher seu personagem e logo em seguida será treinado para se juntar à batalha. <<==`;

  db.prepare(`
    INSERT INTO universes (id, name, welcome_text)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      welcome_text = excluded.welcome_text,
      is_active = 1
  `).run(universeId, universeName, welcome);

  const insertCharacter = db.prepare(`
    INSERT INTO characters (universe_id, name, slug, is_locked, image_path)
    VALUES (@universe_id, @name, @slug, @is_locked, @image_path)
    ON CONFLICT(universe_id, slug) DO UPDATE SET
      name = excluded.name,
      is_locked = excluded.is_locked,
      image_path = excluded.image_path
  `);

  const transaction = db.transaction((characters) => {
    for (const character of characters) {
      const slug = character.slug || slugify(character.name);
      insertCharacter.run({
        universe_id: universeId,
        name: character.name,
        slug,
        is_locked: character.locked ? 1 : 0,
        image_path: character.image_path || `assets/personagens/${slug}.png`,
      });
    }
  });

  transaction(getCharacterTemplates());

  return {
    ok: true,
    message: `✅ Universo ${universeId} criado com uma lista limpa de personagens.`,
  };
}

module.exports = { migrate, createUniverseWithCharacters };
