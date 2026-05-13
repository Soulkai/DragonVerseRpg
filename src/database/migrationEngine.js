const db = require('./db');

function getTableInfo(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function columnExists(table, column) {
  const info = getTableInfo(table);
  return info.some((c) => c.name === column);
}

function addColumnIfMissing(table, column, type) {
  if (!columnExists(table, column)) {
    console.log(`[migration] adicionando coluna ${table}.${column}`);
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
}

// 🔥 FIX PRINCIPAL: não usar wrapper estranho pra CREATE TABLE
function ensureTable(sql) {
  db.exec(sql); // <- ISSO é o correto no better-sqlite3
}

function runMigrations() {
  console.log('[migration] iniciando migrations automáticas...');

  // =========================
  // universe_links
  // =========================
  ensureTable(`
    CREATE TABLE IF NOT EXISTS universe_links (
      universe_id INTEGER PRIMARY KEY,
      chat_id TEXT,
      chat_name TEXT,
      linked_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  addColumnIfMissing('universe_links', 'chat_id', 'TEXT');
  addColumnIfMissing('universe_links', 'chat_name', 'TEXT');
  addColumnIfMissing('universe_links', 'linked_by', 'TEXT');
  addColumnIfMissing('universe_links', 'created_at', 'TEXT');

  // =========================
  // muted_users
  // =========================
  ensureTable(`
    CREATE TABLE IF NOT EXISTS muted_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      user_id TEXT,
      muted_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT
    )
  `);

  // =========================
  // blocked_commands
  // =========================
  ensureTable(`
    CREATE TABLE IF NOT EXISTS blocked_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      command TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // =========================
  // player_travel_state
  // =========================
  ensureTable(`
    CREATE TABLE IF NOT EXISTS player_travel_state (
      player_id INTEGER PRIMARY KEY,
      origin_universe INTEGER,
      origin_chat_id TEXT,
      target_universe INTEGER,
      target_chat_id TEXT,
      started_at TEXT,
      ends_at TEXT,
      active INTEGER DEFAULT 1
    )
  `);

  console.log('[migration] migrations concluídas com sucesso');
}

module.exports = { runMigrations };
