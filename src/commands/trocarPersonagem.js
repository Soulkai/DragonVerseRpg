const { trocarPersonagem } = require('../services/personagemService');

async function trocarPersonagemCommand(message, command) {
  const result = trocarPersonagem(message, command.argsText);
  await message.reply(result.message);
}

module.exports = { trocarPersonagemCommand };
