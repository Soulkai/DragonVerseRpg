const settings = require('../config/settings');
const { getSenderNumber } = require('./text');

function isAdmin(message) {
  const sender = getSenderNumber(message);
  return settings.adminNumbers.includes(sender);
}

module.exports = { isAdmin };
