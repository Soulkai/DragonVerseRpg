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
const { addZeniesCommand, definirKiCommand } = require('./commands/adminEconomia');
const { addUniversoCommand } = require('./commands/addUniverso');
const { addCargoCommand } = require('./commands/addCargo');
const { cargosCommand } = require('./commands/cargos');
const { depositarCommand } = require('./commands/depositar');
const { runEconomyMaintenance } = require('./services/economyService');
const { purgeInactiveCharacters } = require('./services/inactivityService');
const { touchPlayerActivity } = require('./services/playerService');

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

client.on('ready', () => {
  console.log('Bot DragonVerse conectado com sucesso!');
});

client.on('message', async (message) => {
  try {
    const command = parseCommand(message.body || '', settings.prefix);
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

      case 'addzenies':
        await addZeniesCommand(message, command);
        break;

      case 'definirki':
        await definirKiCommand(message, command);
        break;

      case 'adduniverso':
        await addUniversoCommand(message, command);
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

      case 'help':
      case 'ajuda':
      case 'comandos':
        await helpCommand(message, command);
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
