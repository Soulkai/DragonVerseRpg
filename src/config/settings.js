require('dotenv').config();

module.exports = {
  prefix: process.env.BOT_PREFIX || '/',
  dbPath: process.env.DB_PATH || './data/dragonverse.sqlite',
  defaultUniverse: Number(process.env.DEFAULT_UNIVERSE || 2),
  adminNumbers: (process.env.ADMIN_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean),
};
