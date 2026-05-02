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
  patchExistingBoxOpeningsTable();
  patchExistingPlayersTable();
  patchExistingEventDailyStatsTable();
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

    CREATE INDEX IF NOT EXISTS idx_event_daily_stats_date ON event_daily_stats(date_key);
    CREATE INDEX IF NOT EXISTS idx_player_referrals_recruit ON player_referrals(recruit_id, bonus_expires_at);
    CREATE INDEX IF NOT EXISTS idx_bounty_events_lookup ON bounty_events(chat_id, date_key, status);
  `);
}

function patchCharacterClaimIndexes() {
  // Versões antigas tinham um índice único para personagens da Alta Cúpula.
  // Isso podia impedir a correção automática do banco quando um cargo supremo
  // já possuía personagem comum. A repetição entre supremos continua sendo
  // barrada pela lógica do bot em getSupremeClaimByCharacterSlug().
  db.exec(`
    DROP INDEX IF EXISTS idx_unique_supreme_character;

    CREATE INDEX IF NOT EXISTS idx_supreme_character_lookup
    ON character_claims(character_id)
    WHERE claim_type = 'supremo';
  `);
}

function syncSupremeCharacterClaims() {
  const claims = db.prepare(`
    SELECT cc.id, cc.claim_type, p.cargo_id
    FROM character_claims cc
    JOIN players p ON p.id = cc.player_id
  `).all();

  const updateClaim = db.prepare(`
    UPDATE character_claims
    SET claim_type = ?
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const claim of claims) {
      const shouldBeSupreme = isSupremeRoleId(claim.cargo_id);
      const nextClaimType = shouldBeSupreme ? 'supremo' : 'player';

      if (claim.claim_type !== nextClaimType) {
        updateClaim.run(nextClaimType, claim.id);
      }
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

function patchExistingPlayersTable() {
  addColumnIfMissing('players', 'cargo_id', "TEXT NOT NULL DEFAULT 'L.I'");
  addColumnIfMissing('players', 'trabalho_id', 'TEXT');
  addColumnIfMissing('players', 'last_active_at', 'TEXT');
  addColumnIfMissing('players', 'last_salary_at', 'TEXT');
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
        last_deposit_interest_at = COALESCE(last_deposit_interest_at, created_at, CURRENT_TIMESTAMP)
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
      const slug = slugify(character.name);
      insertCharacter.run({
        universe_id: universeId,
        name: character.name,
        slug,
        is_locked: character.locked ? 1 : 0,
        image_path: `assets/personagens/${slug}.png`,
      });
    }
  });

  transaction(personagensUniverso2);

  return {
    ok: true,
    message: `✅ Universo ${universeId} criado com uma lista limpa de personagens.`,
  };
}

module.exports = { migrate, createUniverseWithCharacters };
