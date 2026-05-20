require('dotenv').config();

const prefixes = (process.env.BOT_PREFIXES || process.env.BOT_PREFIX || '/')
  .split(',')
  .map((prefix) => prefix.trim())
  .filter(Boolean);

module.exports = {
  // Prefixo principal, usado apenas para textos antigos ou compatibilidade
  prefix: prefixes[0] || '/',

  // Lista real de prefixos aceitos pelo bot
  prefixes,

  dbPath: process.env.DB_PATH || './data/dragonverse.sqlite',
  defaultUniverse: Number(process.env.DEFAULT_UNIVERSE || 2),
  timezone: process.env.TIMEZONE || 'America/Campo_Grande',

  adminNumbers: (process.env.ADMIN_NUMBERS || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean),
};
