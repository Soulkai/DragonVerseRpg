const {
  createTournament,
  registerTournament,
  startTournament,
  reportWinner,
  tournamentStatus,
} = require('../services/tournamentService');
const { replyWithMentions } = require('../utils/reply');
const { normalizeText } = require('../utils/text');

async function gerarTorneioCommand(message, command, client) {
  const result = await createTournament(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function inscreverTorneioCommand(message, command, client) {
  const result = registerTournament(message, command.argsText);
  await replyWithMentions(message, result, client);
}

async function torneioCommand(message, command, client) {
  const first = normalizeText(String(command.argsText || '').trim().split(/\s+/)[0] || '');
  const result = first === 'iniciar'
    ? await startTournament(message, command.argsText)
    : tournamentStatus(message, command.argsText);

  await replyWithMentions(message, result, client);
}

async function vencedorTorneioCommand(message, command, client) {
  const result = await reportWinner(message, command.argsText);
  await replyWithMentions(message, result, client);
}

module.exports = {
  gerarTorneioCommand,
  inscreverTorneioCommand,
  torneioCommand,
  vencedorTorneioCommand,
};
