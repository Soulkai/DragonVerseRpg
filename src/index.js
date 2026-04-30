const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const settings = require('./config/settings');
const { migrate } = require('./database/migrate');
const { parseCommand } = require('./utils/text');
const { registroCommand } = require('./commands/registro');
const { personagensCommand } = require('./commands/personagens');
const { codigoResgateCommand } = require('./commands/codigoResgate');
const { perfilCommand } = require('./commands/perfil');
const { helpCommand } = require('./commands/help');
const { addZeniesCommand, retirarZeniesCommand, definirKiCommand } = require('./commands/adminEconomia');
const { addUniversoCommand } = require('./commands/addUniverso');
const { addCargoCommand } = require('./commands/addCargo');
const { cargosCommand } = require('./commands/cargos');
const { depositarCommand } = require('./commands/depositar');
const { pixCommand } = require('./commands/pix');
const { lojaCommand } = require('./commands/loja');
const { comprarCommand } = require('./commands/comprar');
const { inventarioCommand } = require('./commands/inventario');
const { eventosCommand, responderCommand, letraCommand, chutarCommand, pegarCommand, tigrinhoCommand } = require('./commands/eventos');
const { addPersonagemCommand, rmvPersonagemCommand } = require('./commands/personagemAdmin');
const { trocarPersonagemCommand } = require('./commands/trocarPersonagem');
const { meuIdCommand } = require('./commands/meuId');
const { blackjackCommand, pokerCommand, trucoCommand } = require('./commands/cardGames');
const { runEconomyMaintenance } = require('./services/economyService');
const { purgeInactiveCharacters } = require('./services/inactivityService');
const { touchPlayerActivity } = require('./services/playerService');
const { runAutoEvents } = require('./services/eventService');

migrate();

let lastMaintenanceAt = 0;
function runMaintenanceIfNeeded(force = false) {
  const now = Date.now();
  if (!force && now - lastMaintenanceAt < 10 * 60 * 1000) return;

  lastMaintenanceAt = now;
  const inactive = purgeInactiveCharacters();
  const economy = runEconomyMaintenance();

  if (inactive.removedClaims > 0) {
    console.log(`[manutencao] Personagens removidos por inatividade: ${inactive.removedClaims}`);
  }

  if (economy.salary.updatedCount > 0 || economy.interest.updatedCount > 0) {
    console.log('[manutencao] Economia atualizada:', economy);
  }
}

runMaintenanceIfNeeded(true);
setInterval(() => runMaintenanceIfNeeded(true), 60 * 60 * 1000);

let lastAutoEventsAt = 0;
async function runAutoEventsIfNeeded(force = false) {
  const now = Date.now();
  if (!force && now - lastAutoEventsAt < 5 * 60 * 1000) return;

  lastAutoEventsAt = now;
  await runAutoEvents(client);
}

function buildPokerAliasCommand(command, actionName) {
  return {
    ...command,
    name: 'poker',
    args: [actionName, ...(command.args || [])],
    argsText: [actionName, command.argsText].filter(Boolean).join(' '),
  };
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'dragonverse-rpg',
    dataPath: './.wwebjs_auth',
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('Escaneie o QR Code abaixo com seu WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('Bot DragonVerse conectado com sucesso!');
  await runAutoEventsIfNeeded(true);
});

setInterval(() => {
  runAutoEventsIfNeeded(false).catch((error) => {
    console.error('Erro ao processar eventos automáticos:', error);
  });
}, 5 * 60 * 1000);

client.on('message', async (message) => {
  try {
    const command = parseCommand(message.body || '', settings.prefixes);
    if (!command) return;

    runMaintenanceIfNeeded(false);
    touchPlayerActivity(message);

    switch (command.name) {
      case 'registro':
        await registroCommand(message, command);
        break;

      case 'personagens':
        await personagensCommand(message, command);
        break;

      case 'codigoresgate':
      case 'codigo resgate':
      case 'códigoresgate':
      case 'código resgate':
        await codigoResgateCommand(message, command);
        break;

      case 'perfil':
        await perfilCommand(message, command);
        break;

      case 'meuid':
      case 'meu id':
      case 'id':
        await meuIdCommand(message, command);
        break;

      case 'loja':
        await lojaCommand(message, command);
        break;

      case 'comprar':
        await comprarCommand(message, command);
        break;

      case 'inventario':
      case 'inventário':
        await inventarioCommand(message, command);
        break;

      case 'addzenies':
        await addZeniesCommand(message, command);
        break;

      case 'retirarzenies':
        await retirarZeniesCommand(message, command);
        break;

      case 'definirki':
        await definirKiCommand(message, command);
        break;

      case 'adduniverso':
        await addUniversoCommand(message, command);
        break;

      case 'addpersonagem':
      case 'add personagem':
        await addPersonagemCommand(message, command);
        break;

      case 'rmvpersonagem':
      case 'removerpersonagem':
      case 'remover personagem':
        await rmvPersonagemCommand(message, command);
        break;

      case 'trocarpersonagem':
      case 'trocar personagem':
        await trocarPersonagemCommand(message, command);
        break;

      case 'addcargo':
        await addCargoCommand(message, command);
        break;

      case 'cargos':
        await cargosCommand(message, command);
        break;

      case 'depositar':
        await depositarCommand(message, command);
        break;

      case 'pix':
        await pixCommand(message, command);
        break;

      case 'transferir':
        await message.reply('Esse comando mudou para */pix @pessoa valor*.');
        break;

      case 'eventos':
      case 'evento':
        await eventosCommand(message, command);
        break;

      case 'responder':
      case 'resposta':
        await responderCommand(message, command);
        break;

      case 'letra':
        await letraCommand(message, command);
        break;

      case 'chutar':
      case 'chute':
        await chutarCommand(message, command);
        break;

      case 'pegar':
        await pegarCommand(message, command);
        break;

      case 'tigrinho':
      case 'cassino':
      case 'cacaniquel':
      case 'caçaníquel':
      case 'caca niquel':
        await tigrinhoCommand(message, command);
        break;

      case 'menu':
      case 'ajuda':
      case 'comandos':
        await helpCommand(message, command);
        break;

      case 'help':
        await message.reply('Esse comando mudou para */menu*.');
        break;

      case 'blackjack':
      case 'bj':
        await blackjackCommand(message, command, client);
        break;

      case 'poker':
        await pokerCommand(message, command, client);
        break;

      case 'check':
      case 'cobrir':
      case 'pote':
      case 'out':
      case 'sair':
      case 'allin':
        await pokerCommand(message, buildPokerAliasCommand(command, command.name), client);
        break;

      case 'truco':
        await trucoCommand(message, command, client);
        break;

      default:
        break;
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    await message.reply('Ocorreu um erro interno ao processar esse comando.');
  }
});

client.initialize();
