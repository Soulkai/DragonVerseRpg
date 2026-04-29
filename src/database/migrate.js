const db = require('./db');
const personagensUniverso2 = require('../data/personagensUniverso2');
const { slugify } = require('../utils/text');
const { STARTING_ZENIES, calculateTotalSalary } = require('../data/roles');

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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_supreme_character
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
  `);

  patchExistingPlayersTable();
  seedUniverse2();
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
