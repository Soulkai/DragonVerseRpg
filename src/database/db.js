const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const settings = require('../config/settings');

const dbFile = path.resolve(process.cwd(), settings.dbPath);
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
