const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const settings = require('./config/settings');
const { migrate } = require('./database/migrate');
const { parseCommand } = require('./utils/text');

// --- Importação de Comandos ---
const { registroCommand } = require('./commands/registro');
const { personagensCommand } = require('./commands/personagens');
const { codigoResgateCommand } = require('./commands/codigoResgate');
const { perfilCommand } = require('./commands/perfil');
const { helpCommand } = require('./commands/help');
const { addZeniesCommand, retirarZeniesCommand, definirKiCommand } = require('./commands/adminEconomia');
const { addUniversoCommand } = require('./commands/addUniverso');
const { addCargoCommand } = require('./commands/addCargo');
const { cargosCommand } = require('./commands/cargos');
const { depositarCommand, retirarPoupancaCommand, saldoCommand } = require('./commands/depositar');
const { pixCommand } = require('./commands/pix');
const { lojaCommand } = require('./commands/loja');
const { comprarCommand } = require('./commands/comprar');
const { inventarioCommand } = require('./commands/inventario');
const { eventosCommand, responderCommand, letraCommand, chutarCommand, pegarCommand, tigrinhoCommand, rankEventosCommand, presencaCommand } = require('./commands/eventos');
const { addPersonagemCommand, rmvPersonagemCommand } = require('./commands/personagemAdmin');
const { trocarPersonagemCommand } = require('./commands/trocarPersonagem');
const { meuIdCommand } = require('./commands/meuId');
const { blackjackCommand, pokerCommand, trucoCommand, ltrucoCommand, trucoAnyCommand, regrasCommand } = require('./commands/cardGames');
const { conviteCommand } = require('./commands/convite');
const { codesCommand, resgatarCommand } = require('./commands/codes');
const { caixaCommand } = require('./commands/caixa');
const { vitoriaCommand, bountyCommand } = require('./commands/bounty');
const { gerarTorneioCommand, inscreverTorneioCommand, torneioCommand, vencedorTorneioCommand } = require('./commands/torneio');
const { playersListCommand, deletePlayerCommand } = require('./commands/playerAdmin');
const { rankeadaCommand, listaRankCommand, iRankCommand, desafioCommand, aceitarDesafioCommand, recusarDesafioCommand, registrarVencedorRankedCommand, removerRankCommand } = require('./commands/ranked');
const { zMarketCommand, zBuyCommand } = require('./commands/zMarket');
const { inspecionarCommand } = require('./commands/inspecionar');
const { extratoCommand } = require('./commands/extrato');
const { emprestimoCommand } = require('./commands/emprestimo');
const { viagemCommand } = require('./commands/viagem');

// --- Importação de Serviços ---
const { runEconomyMaintenance } = require('./services/economyService');
const { purgeInactiveCharacters } = require('./services/inactivityService');
const { touchPlayerActivity } = require('./services/playerService');
const { runAutoEvents } = require('./services/eventService');
const { spotifySearch, spotifyDownload } = require('./services/spotifyService');
const { processExpiredTravels } = require('./services/travelService');

// 1. Inicializar Banco de Dados
migrate();

// 2. Inicializar o Client (Deve vir antes das funções de manutenção que usam 'client')
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

// 3. Lógica de Manutenção
let lastMaintenanceAt = 0;
function runMaintenanceIfNeeded(force = false) {
  const now = Date.now();
  if (!force && now - lastMaintenanceAt < 10 * 60 * 1000) return;

  lastMaintenanceAt = now;
  const inactive = purgeInactiveCharacters();
  const economy = runEconomyMaintenance();
  
  // Processa retorno automático de viagens expiradas
  const travelCount = processExpiredTravels(client);

  if (inactive.removedClaims > 0) {
    console.log(`[manutencao] Personagens removidos por inatividade: ${inactive.removedClaims}`);
  }
  if (travelCount > 0) {
    console.log(`[manutencao] ${travelCount} jogadores retornaram de suas viagens.`);
  }
  if (economy.salary.updatedCount > 0 || economy.interest.updatedCount > 0) {
    console.log('[manutencao] Economia atualizada:', economy);
  }
}

// Manutenção inicial
runMaintenanceIfNeeded(true);
setInterval(() => runMaintenanceIfNeeded(false), 60 * 60 * 1000);

let lastAutoEventsAt = 0;
async function runAutoEventsIfNeeded(force = false) {
  const now = Date.now();
  if (!force && now - lastAutoEventsAt < 5 * 60 * 1000) return;
  lastAutoEventsAt = now;
  await runAutoEvents(client);
}

// --- Eventos do Client ---
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
      case 'players':
      case 'jogadores':
        await playersListCommand(message, command, client);
        break;
      case 'deleteplayer':
      case 'deletarplayer':
        await deletePlayerCommand(message, command, client);
        break;
      case 'codigoresgate':
        await codigoResgateCommand(message, command);
        break;
      case 'spotify':
        await spotifySearch(message, command);
        break;
      case 'spotify2':
        await spotifyDownload(message, command, client);
        break;
      case 'perfil':
        await perfilCommand(message, command);
        break;
      case 'meuid':
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
        await addZeniesCommand(message, command, client);
        break;
      case 'retirarzenies':
        await retirarZeniesCommand(message, command, client);
        break;
      case 'definirki':
        await definirKiCommand(message, command, client);
        break;
      case 'adduniverso':
        await addUniversoCommand(message, command);
        break;
      case 'addpersonagem':
        await addPersonagemCommand(message, command);
        break;
      case 'rmvpersonagem':
      case 'removerpersonagem':
        await rmvPersonagemCommand(message, command);
        break;
      case 'viajar': 
      case 'linkar': 
        await viagemCommand(message, command, client);
        break;
      case 'trocarpersonagem':
        await trocarPersonagemCommand(message, command);
        break;
      case 'addcargo':
        await addCargoCommand(message, command, client);
        break;
      case 'cargos':
        await cargosCommand(message, command);
        break;
      case 'depositar':
        await depositarCommand(message, command, client);
        break;
      case 'saldo':
      case 'poupanca':
        await saldoCommand(message, command, client);
        break;
      case 'sacarpoupanca':
      case 'retirarpoupanca':
        await retirarPoupancaCommand(message, command, client);
        break;
      case 'pix':
        await pixCommand(message, command, client);
        break;
      case 'transferir':
        await message.reply('Esse comando mudou para */pix @pessoa valor*.');
        break;
      case 'extrato':
        await extratoCommand(message, command, client);
        break;
      case 'emprestimo':
      case 'loan':
        await emprestimoCommand(message, command, client);
        break;
      case 'convite':
        await conviteCommand(message, command, client);
        break;
      case 'codes':
      case 'code':
        await codesCommand(message, command, client);
        break;
      case 'resgatar':
        await resgatarCommand(message, command, client);
        break;
      case 'inspecionar':
      case 'inspect':
        await inspecionarCommand(message, command, client);
        break;
      case 'caixa':
        await caixaCommand(message, command, client);
        break;
      case 'rankeada':
        await rankeadaCommand(message, command, client);
        break;
      case 'listarank':
      case 'ranklist':
        await listaRankCommand(message, command, client);
        break;
      case 'irank':
        await iRankCommand(message, command, client);
        break;
      case 'desafio':
        await desafioCommand(message, command, client);
        break;
      case 'aceitardesafio':
        await aceitarDesafioCommand(message, command, client);
        break;
      case 'recusardesafio':
        await recusarDesafioCommand(message, command, client);
        break;
      case 'rv':
        await registrarVencedorRankedCommand(message, command, client);
        break;
      case 'removerrank':
        await removerRankCommand(message, command, client);
        break;
      case 'zmarket':
        await zMarketCommand(message, command, client);
        break;
      case 'zbuy':
        await zBuyCommand(message, command, client);
        break;
      case 'gerartorneio':
        await gerarTorneioCommand(message, command, client);
        break;
      case 'inscrever':
        await inscreverTorneioCommand(message, command, client);
        break;
      case 'torneio':
        await torneioCommand(message, command, client);
        break;
      case 'vencedor':
        await vencedorTorneioCommand(message, command, client);
        break;
      case 'eventos':
        await eventosCommand(message, command, client);
        break;
      case 'rankeventos':
        await rankEventosCommand(message, command, client);
        break;
      case 'presenca':
        await presencaCommand(message, command, client);
        break;
      case 'cacacabeca':
        await bountyCommand(message, command, client);
        break;
      case 'vitoria':
        await vitoriaCommand(message, command, client);
        break;
      case 'responder':
        await responderCommand(message, command, client);
        break;
      case 'letra':
        await letraCommand(message, command, client);
        break;
      case 'chutar':
        await chutarCommand(message, command, client);
        break;
      case 'pegar':
        await pegarCommand(message, command, client);
        break;
      case 'tigrinho':
        await tigrinhoCommand(message, command, client);
        break;
      case 'menu':
      case 'ajuda':
      case 'comandos':
        await helpCommand(message, command);
        break;
      case 'blackjack':
      case 'bj':
        await blackjackCommand(message, command, client);
        break;
      case 'poker':
        await pokerCommand(message, command, client);
        break;
      case 'truco':
        await trucoCommand(message, command, client);
        break;
      case 'ltruco':
        await ltrucoCommand(message, command, client);
        break;
      case '3': case '6': case '9': case '12':
      case 'aceitar': case 'recusar':
        await trucoAnyCommand(message, { ...command, argsText: command.name }, client);
        break;
      case 'regras':
        await regrasCommand(message, command, client);
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
