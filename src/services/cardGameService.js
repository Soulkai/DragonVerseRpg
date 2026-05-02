const db = require('../database/db');
const { parseAmount } = require('../utils/numbers');
const { money } = require('../utils/format');
const { normalizeText } = require('../utils/text');
const { getOrCreatePlayerFromMessage, getPlayerByWhatsAppId } = require('./playerService');
const { grantZenies } = require('./rewardService');

const MIN_CARD_BET = 1_000_000;

const blackjackGames = new Map();
const pokerGames = new Map();
const trucoGames = new Map();

const SUITS = [
  { symbol: '♣️', name: 'Paus', trucoPower: 4 },
  { symbol: '♥️', name: 'Copas', trucoPower: 3 },
  { symbol: '♠️', name: 'Espadas', trucoPower: 2 },
  { symbol: '♦️', name: 'Ouros', trucoPower: 1 },
];

const POKER_RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const POKER_VALUES = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const TRUCO_RANKS_LOW_TO_HIGH = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const TRUCO_DECK_RANKS = ['3', '2', 'A', 'K', 'J', 'Q', '7', '6', '5', '4'];
const TRUCO_TARGET_POINTS = 12;

function normalizeAction(value = '') {
  return normalizeText(value);
}

function firstToken(argsText = '') {
  return String(argsText || '').trim().split(/\s+/)[0] || '';
}

function restAfterFirst(argsText = '') {
  const parts = String(argsText || '').trim().split(/\s+/);
  parts.shift();
  return parts.join(' ');
}

function createDeck(ranks = POKER_RANKS) {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ rank, suit: suit.symbol, suitName: suit.name, trucoPower: suit.trucoPower });
    }
  }
  return shuffle(deck);
}

function shuffle(deck) {
  const copy = [...deck];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function draw(deck, amount = 1) {
  return deck.splice(0, amount);
}

function cardText(card) {
  if (!card) return 'Carta desconhecida';
  return `${card.rank}${card.suit}`;
}

function cardsText(cards = []) {
  return cards.map(cardText).join('  ');
}

function addZenies(playerId, amount, options = {}) {
  grantZenies(playerId, amount, 'jogos_cartas', options);
}

function removeZenies(playerId, amount) {
  db.prepare(`
    UPDATE players
    SET zenies = MAX(zenies - ?, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, playerId);
}

function getFreshPlayer(player) {
  return getPlayerByWhatsAppId(player.whatsapp_id) || player;
}

async function sendPrivate(client, whatsappId, text) {
  try {
    await client.sendMessage(whatsappId, text);
    return true;
  } catch (error) {
    console.error(`[cards] Falha ao enviar privado para ${whatsappId}:`, error.message);
    return false;
  }
}

function parseBet(input, defaultValue = null) {
  const parsed = parseAmount(String(input || '').split(/\s+/)[0]);
  return parsed || defaultValue;
}

function requireRegisteredBalance(player, amount) {
  if (!amount || amount < MIN_CARD_BET) {
    return {
      ok: false,
      message: `Aposta mínima: *${money(MIN_CARD_BET)} Zenies*.`,
    };
  }

  if (Number(player.zenies || 0) < amount) {
    return {
      ok: false,
      message: `Saldo insuficiente. Você tem *${money(player.zenies)} Zenies*.`,
    };
  }

  return { ok: true };
}

function mentionTagFromId(whatsappId = '') {
  const id = String(whatsappId || '').trim();
  if (!id) return '';
  return id.split('@')[0].replace(/[^0-9a-zA-Z]/g, '');
}

function mentionPlayer(player) {
  const tag = mentionTagFromId(player?.whatsapp_id) || String(player?.phone || '').replace(/\D/g, '');
  return tag ? `@${tag}` : '@jogador';
}

function mentionIds(players = []) {
  return [...new Set(players.map((player) => player?.whatsapp_id).filter(Boolean))];
}

function splitByTeam(game, teamId) {
  return game.players.filter((player) => player.team === teamId);
}

// =========================
// Regras
// =========================

function pokerRules() {
  return [
    '╭━━⪩ ♠️ *REGRAS DO POKER* ⪨━━',
    '▢',
    '▢ • Modalidade usada: *Texas Hold’em simplificado*.',
    '▢ • Cada jogador recebe *2 cartas privadas*.',
    '▢ • A mesa pode abrir até *5 cartas comunitárias*.',
    '▢ • A melhor combinação de *5 cartas* vence.',
    '▢ • Ações: */check*, */cobrir*, */poker apostar valor*, */allin*, */out*.',
    '▢ • Quando todos agem, a mesa avança automaticamente.',
    '▢',
    '▢ *Combinações da mais forte para a mais fraca:*',
    '▢ 1. *Straight Flush* — sequência do mesmo naipe.',
    '▢ 2. *Quadra* — quatro cartas iguais.',
    '▢ 3. *Full House* — trinca + par.',
    '▢ 4. *Flush* — cinco cartas do mesmo naipe.',
    '▢ 5. *Sequência* — cinco cartas em ordem.',
    '▢ 6. *Trinca* — três cartas iguais.',
    '▢ 7. *Dois Pares* — dois pares diferentes.',
    '▢ 8. *Par* — duas cartas iguais.',
    '▢ 9. *Carta Alta* — maior carta quando ninguém combina.',
    '╰━━─「♠️」─━━',
  ].join('\n');
}

function blackjackRules() {
  return [
    '╭━━⪩ 🃏 *REGRAS DO BLACKJACK* ⪨━━',
    '▢',
    '▢ • Objetivo: chegar o mais perto possível de *21* sem passar.',
    '▢ • Cartas numéricas valem o próprio número.',
    '▢ • J, Q e K valem *10*.',
    '▢ • Ás vale *1 ou 11*, o que for melhor para a mão.',
    '▢ • Cada jogador entra na mesa com */blackjack entrar*.',
    '▢ • Depois de iniciado, cada jogador joga na sua vez.',
    '▢ • Use */carta* para pedir carta.',
    '▢ • Use */parar* para encerrar sua mão.',
    '▢ • Depois de todos pararem/estourarem, a mesa joga.',
    '▢ • Vitória paga *2x* a aposta. Empate devolve a aposta.',
    '╰━━─「🃏」─━━',
  ].join('\n');
}

function trucoRules() {
  return [
    '╭━━⪩ 🃏 *REGRAS DO TRUCO PAULISTA LIMPO* ⪨━━',
    '▢',
    '▢ • Crie a mesa com */truco criar valor*.',
    '▢ • Jogo pode ter *2 jogadores* ou *4 jogadores*.',
    '▢ • Com 4 jogadores, o bot sorteia as duplas.',
    '▢ • Baralho limpo: sem 8, 9, 10 e coringas.',
    '▢ • O bot entrega *3 cartas* no privado.',
    '▢ • O bot mostra a *vira* e a *manilha* no grupo.',
    '▢ • Use */truco jogar 1* para jogar a carta 1 da sua mão.',
    '▢ • A mão pode valer 1, 3, 6, 9 ou 12 pontos.',
    '▢ • Comandos: */truco truco*, */truco seis*, */truco nove*, */truco doze*.',
    '▢ • Vence quem chegar a *12 pontos* primeiro.',
    '▢ • Em 1v1, o vencedor recebe o prêmio inteiro.',
    '▢ • Em 2v2, o prêmio é dividido entre a dupla vencedora.',
    '╰━━─「🃏」─━━',
  ].join('\n');
}

function regrasCartas(argsText = '') {
  const type = normalizeAction(firstToken(argsText));
  if (['poker', 'poquer', 'pôker'].includes(type)) return { ok: true, message: pokerRules() };
  if (['blackjack', 'black', 'bj', '21'].includes(type)) return { ok: true, message: blackjackRules() };
  if (['truco'].includes(type)) return { ok: true, message: trucoRules() };

  return {
    ok: true,
    message: [
      '╭━━⪩ 📜 *REGRAS DOS JOGOS* ⪨━━',
      '▢',
      '▢ • */regras poker*',
      '▢ • */regras blackjack*',
      '▢ • */regras truco*',
      '╰━━─「📜」─━━',
    ].join('\n'),
  };
}

// =========================
// Blackjack em mesa
// =========================

function blackjackScore(cards = []) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces += 1;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function createBlackjackPlayer(player) {
  return {
    id: player.id,
    whatsapp_id: player.whatsapp_id,
    phone: player.phone,
    display_name: player.display_name,
    hand: [],
    bet: 0,
    stopped: false,
    busted: false,
    blackjack: false,
  };
}

function findBlackjackPlayer(game, playerId) {
  return game.players.find((player) => player.id === playerId);
}

function getBlackjackCurrentPlayer(game) {
  if (game.status !== 'playing') return null;
  for (let offset = 0; offset < game.players.length; offset += 1) {
    const index = (game.currentTurnIndex + offset) % game.players.length;
    const player = game.players[index];
    if (!player.stopped && !player.busted) {
      game.currentTurnIndex = index;
      return player;
    }
  }
  return null;
}

function nextBlackjackPlayer(game) {
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length;
  return getBlackjackCurrentPlayer(game);
}

function formatBlackjackTable(game, revealDealer = false) {
  const current = getBlackjackCurrentPlayer(game);
  const dealerCards = revealDealer
    ? cardsText(game.dealerHand)
    : game.dealerHand.length ? `${cardText(game.dealerHand[0])}  🂠` : 'Ainda não revelada';
  const dealerScore = revealDealer ? blackjackScore(game.dealerHand) : blackjackScore(game.dealerHand.slice(0, 1));

  return [
    '╭━━⪩ 🃏 *BLACKJACK DRAGONVERSE* ⪨━━',
    '▢',
    `▢ • Entrada: *${money(game.buyIn)} Zenies*`,
    `▢ • Jogadores: *${game.players.length}*`,
    `▢ • Status: *${game.status === 'waiting' ? 'Aguardando' : 'Em andamento'}*`,
    current ? `▢ • Vez de: ${mentionPlayer(current)}` : null,
    '▢',
    `▢ • Mesa: ${dealerCards}`,
    revealDealer ? `▢ • Pontuação da mesa: *${dealerScore}*` : null,
    '▢',
    '▢ • Jogadores:',
    ...game.players.map((player) => {
      const score = blackjackScore(player.hand);
      const state = player.busted ? 'estourou' : player.stopped ? 'parou' : 'jogando';
      return `▢   ${mentionPlayer(player)} — ${cardsText(player.hand) || 'sem cartas'} | *${score}* | ${state}`;
    }),
    '╰━━─「🃏」─━━',
  ].filter(Boolean).join('\n');
}

function everyoneFinishedBlackjack(game) {
  return game.players.every((player) => player.stopped || player.busted);
}

function finishBlackjackTable(chatId, game) {
  while (blackjackScore(game.dealerHand) < 17) {
    game.dealerHand.push(...draw(game.deck, 1));
  }

  const dealerScore = blackjackScore(game.dealerHand);
  const dealerBust = dealerScore > 21;
  const lines = [formatBlackjackTable(game, true), '', '🏁 *Resultado final:*'];

  for (const player of game.players) {
    const score = blackjackScore(player.hand);
    let payout = 0;
    let result = 'perdeu';

    if (player.busted || score > 21) {
      result = 'estourou e perdeu';
    } else if (player.blackjack && dealerScore !== 21) {
      payout = Math.floor(player.bet * 2.5);
      result = 'fez Blackjack natural e venceu';
    } else if (dealerBust || score > dealerScore) {
      payout = player.bet * 2;
      result = 'venceu';
    } else if (score === dealerScore) {
      payout = player.bet;
      result = 'empatou e recebeu a aposta de volta';
    }

    if (payout > 0) addZenies(player.id, payout);
    lines.push(`• ${mentionPlayer(player)} ${result}. Recebeu: *${money(payout)} Zenies*.`);
  }

  blackjackGames.delete(chatId);
  return { ok: true, message: lines.join('\n'), mentions: mentionIds(game.players) };
}

function finishBlackjackAction(chatId, game, actionLine) {
  if (everyoneFinishedBlackjack(game)) {
    const finished = finishBlackjackTable(chatId, game);
    return { ...finished, message: [actionLine, '', finished.message].filter(Boolean).join('\n') };
  }

  const next = nextBlackjackPlayer(game);
  return {
    ok: true,
    message: [
      actionLine,
      '',
      next ? `🎯 Agora é a vez de ${mentionPlayer(next)}.` : null,
      '',
      formatBlackjackTable(game),
    ].filter(Boolean).join('\n'),
    mentions: mentionIds(game.players),
  };
}

async function blackjack(message, argsText = '', client) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const actionRaw = firstToken(argsText);
  const action = normalizeAction(actionRaw);
  const rest = restAfterFirst(argsText);
  const chatId = message.from;
  let game = blackjackGames.get(chatId);

  if (!action) return { ok: true, message: blackjackRules() };

  if (['criar', 'mesa', 'iniciar'].includes(action) || parseAmount(actionRaw)) {
    if (game) return { ok: false, message: 'Já existe uma mesa de Blackjack ativa neste grupo.' };

    const betText = parseAmount(actionRaw) ? argsText : rest;
    const buyIn = parseBet(betText);
    const validation = requireRegisteredBalance(player, buyIn);
    if (!validation.ok) return { ok: false, message: `Use assim: */blackjack criar 1000000*\n${validation.message}` };

    removeZenies(player.id, buyIn);
    const bjPlayer = createBlackjackPlayer(player);
    bjPlayer.bet = buyIn;
    game = {
      chatId,
      status: 'waiting',
      createdBy: player.id,
      buyIn,
      deck: [],
      dealerHand: [],
      currentTurnIndex: 0,
      players: [bjPlayer],
    };
    blackjackGames.set(chatId, game);

    return {
      ok: true,
      message: [
        '🃏 *Mesa de Blackjack criada!*',
        '',
        `Entrada: *${money(buyIn)} Zenies*`,
        `Criador: ${mentionPlayer(bjPlayer)}`,
        '',
        'Use */blackjack entrar* para participar.',
        'Depois use */blackjack start* para começar.',
      ].join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  if (!game) return { ok: false, message: 'Não existe mesa de Blackjack ativa. Use */blackjack criar valor*.' };

  if (['entrar', 'join'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa de Blackjack já começou.' };
    if (findBlackjackPlayer(game, player.id)) return { ok: false, message: 'Você já está nessa mesa.' };

    const fresh = getFreshPlayer(player);
    const validation = requireRegisteredBalance(fresh, game.buyIn);
    if (!validation.ok) return validation;

    removeZenies(player.id, game.buyIn);
    const bjPlayer = createBlackjackPlayer(fresh);
    bjPlayer.bet = game.buyIn;
    game.players.push(bjPlayer);

    return {
      ok: true,
      message: `✅ ${mentionPlayer(bjPlayer)} entrou na mesa de Blackjack. Jogadores: *${game.players.length}*.`,
      mentions: mentionIds(game.players),
    };
  }

  if (['start', 'comecar', 'começar'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa já foi iniciada.' };
    if (player.id !== game.createdBy) return { ok: false, message: 'Apenas quem criou a mesa pode iniciar.' };
    if (game.players.length < 1) return { ok: false, message: 'A mesa precisa de pelo menos 1 jogador.' };

    game.status = 'playing';
    game.deck = createDeck();
    game.dealerHand = draw(game.deck, 2);
    game.currentTurnIndex = 0;
    for (const bjPlayer of game.players) {
      bjPlayer.hand = draw(game.deck, 2);
      bjPlayer.blackjack = blackjackScore(bjPlayer.hand) === 21;
      bjPlayer.stopped = bjPlayer.blackjack;
      bjPlayer.busted = false;
    }

    const current = getBlackjackCurrentPlayer(game);
    if (!current) return finishBlackjackTable(chatId, game);

    return {
      ok: true,
      message: ['🃏 *Blackjack iniciado!*', '', `🎯 Primeira vez: ${mentionPlayer(current)}.`, '', formatBlackjackTable(game)].join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  if (['status', 'mesa'].includes(action)) return { ok: true, message: formatBlackjackTable(game), mentions: mentionIds(game.players) };

  const bjPlayer = findBlackjackPlayer(game, player.id);
  if (!bjPlayer) return { ok: false, message: 'Você não está nessa mesa de Blackjack.' };
  if (game.status !== 'playing') return { ok: false, message: 'A mesa ainda não começou. Use */blackjack start*.' };

  const current = getBlackjackCurrentPlayer(game);
  if (current && current.id !== bjPlayer.id) {
    return { ok: false, message: `Ainda não é sua vez. Agora é a vez de ${mentionPlayer(current)}.`, mentions: mentionIds(game.players) };
  }

  if (['carta', 'hit', 'pedir', 'comprar'].includes(action)) {
    bjPlayer.hand.push(...draw(game.deck, 1));
    const score = blackjackScore(bjPlayer.hand);
    if (score > 21) {
      bjPlayer.busted = true;
      bjPlayer.stopped = true;
      return finishBlackjackAction(chatId, game, `💥 ${mentionPlayer(bjPlayer)} pediu carta e estourou com *${score}*.`);
    }

    return {
      ok: true,
      message: [`🃏 ${mentionPlayer(bjPlayer)} pediu carta. Pontuação atual: *${score}*.`, '', 'Use */carta* para pedir outra ou */parar* para parar.', '', formatBlackjackTable(game)].join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  if (['parar', 'stand', 'ficar'].includes(action)) {
    bjPlayer.stopped = true;
    return finishBlackjackAction(chatId, game, `🛑 ${mentionPlayer(bjPlayer)} parou com *${blackjackScore(bjPlayer.hand)}*.`);
  }

  if (['cancelar'].includes(action)) {
    if (player.id !== game.createdBy) return { ok: false, message: 'Apenas quem criou a mesa pode cancelar.' };
    blackjackGames.delete(chatId);
    return { ok: true, message: 'Mesa de Blackjack cancelada. Apostas já colocadas não são devolvidas.' };
  }

  return { ok: false, message: 'Ação de Blackjack inválida. Use */regras blackjack*.' };
}

// =========================
// Poker Texas Hold'em com turnos automáticos
// =========================

function createPokerPlayer(player) {
  return {
    id: player.id,
    whatsapp_id: player.whatsapp_id,
    phone: player.phone,
    display_name: player.display_name || player.phone,
    hand: [],
    invested: 0,
    streetBet: 0,
    folded: false,
    allIn: false,
    acted: false,
  };
}

function findPokerPlayer(game, playerId) {
  return game.players.find((item) => item.id === playerId);
}

function activePokerPlayers(game) {
  return game.players.filter((player) => !player.folded);
}

function playablePokerPlayers(game) {
  return game.players.filter((player) => !player.folded && !player.allIn);
}

function getPokerCurrentPlayer(game) {
  if (game.status !== 'playing') return null;
  const playable = playablePokerPlayers(game);
  if (playable.length === 0) return null;

  for (let offset = 0; offset < game.players.length; offset += 1) {
    const index = (game.currentTurnIndex + offset) % game.players.length;
    const player = game.players[index];
    if (!player.folded && !player.allIn) {
      game.currentTurnIndex = index;
      return player;
    }
  }

  return null;
}

function setNextPokerTurn(game) {
  if (game.status !== 'playing') return null;
  const playable = playablePokerPlayers(game);
  if (playable.length === 0) return null;

  const start = typeof game.currentTurnIndex === 'number' ? game.currentTurnIndex + 1 : 0;
  for (let offset = 0; offset < game.players.length; offset += 1) {
    const index = (start + offset) % game.players.length;
    const player = game.players[index];
    if (!player.folded && !player.allIn) {
      game.currentTurnIndex = index;
      return player;
    }
  }

  return null;
}

function resetPokerBettingRound(game) {
  game.currentBet = 0;
  for (const player of game.players) {
    player.streetBet = 0;
    player.acted = player.folded || player.allIn;
  }

  const next = playablePokerPlayers(game)[0] || null;
  game.currentTurnIndex = next ? game.players.indexOf(next) : 0;
}

function isPokerBettingRoundComplete(game) {
  const playable = playablePokerPlayers(game);
  if (playable.length === 0) return true;
  return playable.every((player) => player.acted && player.streetBet === game.currentBet);
}

function formatPokerTable(game) {
  const status = game.status === 'waiting' ? 'Aguardando jogadores' : 'Em andamento';
  const activePlayers = activePokerPlayers(game).length;
  const current = getPokerCurrentPlayer(game);

  return [
    '╭━━⪩ ♠️ *POKER DRAGONVERSE* ⪨━━',
    '▢',
    `▢ • Status: *${status}*`,
    `▢ • Entrada: *${money(game.buyIn)} Zenies*`,
    `▢ • Pote total: *${money(game.pot)} Zenies*`,
    `▢ • Aposta da rodada: *${money(game.currentBet || 0)} Zenies*`,
    `▢ • Jogadores ativos: *${activePlayers}/${game.players.length}*`,
    `▢ • Etapa: *${game.stage}*`,
    current ? `▢ • Vez de: ${mentionPlayer(current)}` : null,
    '▢',
    `▢ • Mesa: ${game.community.length ? cardsText(game.community) : 'Nenhuma carta aberta ainda.'}`,
    '▢',
    '▢ • Jogadores:',
    ...game.players.map((player, index) => {
      const tags = [];
      if (player.folded) tags.push('out');
      if (player.allIn) tags.push('all-in');
      if (player.acted && !player.folded && !player.allIn) tags.push('agiu');
      const tagText = tags.length ? ` — ${tags.join(', ')}` : '';
      return `▢   ${index + 1}. ${mentionPlayer(player)} — total: ${money(player.invested)} | rodada: ${money(player.streetBet)}${tagText}`;
    }),
    '╰━━─「♠️」─━━',
  ].filter(Boolean).join('\n');
}

function cardCombinations(cards, size = 5) {
  const result = [];
  function walk(start, combo) {
    if (combo.length === size) {
      result.push(combo);
      return;
    }
    for (let index = start; index < cards.length; index += 1) {
      walk(index + 1, [...combo, cards[index]]);
    }
  }
  walk(0, []);
  return result;
}

function compareRankArrays(left, right) {
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const a = left[index] || 0;
    const b = right[index] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function straightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let index = 0; index <= unique.length - 5; index += 1) {
    const slice = unique.slice(index, index + 5);
    if (slice[0] - slice[4] === 4) return slice[0];
  }
  return 0;
}

function evaluateFiveCards(cards) {
  const values = cards.map((card) => POKER_VALUES[card.rank]).sort((a, b) => b - a);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const straight = straightHigh(values);
  const countsMap = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  const groups = Object.entries(countsMap)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  if (flush && straight) return { score: [8, straight], label: 'Straight Flush' };
  const four = groups.find((group) => group.count === 4);
  if (four) {
    const kicker = groups.find((group) => group.value !== four.value).value;
    return { score: [7, four.value, kicker], label: 'Quadra' };
  }
  const trips = groups.filter((group) => group.count === 3).sort((a, b) => b.value - a.value);
  const three = trips[0];
  const pair = groups.find((group) => group.count === 2) || trips[1];
  if (three && pair) return { score: [6, three.value, pair.value], label: 'Full House' };
  if (flush) return { score: [5, ...values], label: 'Flush' };
  if (straight) return { score: [4, straight], label: 'Sequência' };
  if (three) {
    const kickers = groups.filter((group) => group.value !== three.value).map((group) => group.value).sort((a, b) => b - a);
    return { score: [3, three.value, ...kickers], label: 'Trinca' };
  }
  const pairs = groups.filter((group) => group.count === 2).sort((a, b) => b.value - a.value);
  if (pairs.length >= 2) {
    const kicker = groups.find((group) => !pairs.slice(0, 2).some((pairGroup) => pairGroup.value === group.value)).value;
    return { score: [2, pairs[0].value, pairs[1].value, kicker], label: 'Dois Pares' };
  }
  if (pairs.length === 1) {
    const kickers = groups.filter((group) => group.value !== pairs[0].value).map((group) => group.value).sort((a, b) => b - a);
    return { score: [1, pairs[0].value, ...kickers], label: 'Par' };
  }
  return { score: [0, ...values], label: 'Carta Alta' };
}

function evaluateBestHand(cards) {
  const combos = cardCombinations(cards, 5);
  let best = null;
  for (const combo of combos) {
    const evaluated = evaluateFiveCards(combo);
    if (!best || compareRankArrays(evaluated.score, best.score) > 0) {
      best = { ...evaluated, cards: combo };
    }
  }
  return best;
}

function evaluatePokerContenders(game) {
  const contenders = activePokerPlayers(game);
  const evaluated = contenders.map((player) => ({
    player,
    result: evaluateBestHand([...player.hand, ...game.community]),
  }));
  evaluated.sort((a, b) => compareRankArrays(b.result.score, a.result.score));
  return evaluated;
}

function resolvePokerSidePots(game, evaluated) {
  const byPlayerId = new Map(evaluated.map((item) => [item.player.id, item]));
  const levels = [...new Set(game.players.map((player) => Number(player.invested || 0)).filter((value) => value > 0))]
    .sort((a, b) => a - b);
  const payouts = new Map();
  const details = [];
  let previous = 0;

  for (const level of levels) {
    const contributors = game.players.filter((player) => Number(player.invested || 0) >= level);
    const potAmount = (level - previous) * contributors.length;
    if (potAmount <= 0) {
      previous = level;
      continue;
    }
    const eligible = contributors.filter((player) => !player.folded && byPlayerId.has(player.id));
    if (eligible.length === 0) {
      previous = level;
      continue;
    }
    const eligibleEvaluated = eligible
      .map((player) => byPlayerId.get(player.id))
      .sort((a, b) => compareRankArrays(b.result.score, a.result.score));
    const bestScore = eligibleEvaluated[0].result.score;
    const winners = eligibleEvaluated.filter((item) => compareRankArrays(item.result.score, bestScore) === 0);
    const split = Math.floor(potAmount / winners.length);
    for (const winner of winners) {
      payouts.set(winner.player.id, (payouts.get(winner.player.id) || 0) + split);
    }
    details.push({ amount: potAmount, winners: winners.map((item) => item.player), split, label: winners[0].result.label });
    previous = level;
  }

  return { payouts, details };
}

function finishPokerBySingleWinner(chatId, game, winner, reason) {
  while (game.community.length < 5) game.community.push(...draw(game.deck, 1));
  const evaluated = [{ player: winner, result: evaluateBestHand([...winner.hand, ...game.community]) }];
  const { payouts, details } = resolvePokerSidePots(game, evaluated);
  const payout = payouts.get(winner.id) || 0;
  if (payout > 0) addZenies(winner.id, payout);
  pokerGames.delete(chatId);

  return {
    message: [
      '🏆 *Poker encerrado!*',
      '',
      reason,
      `Vencedor: ${mentionPlayer(winner)}`,
      `Pote recebido: *${money(payout)} Zenies*`,
      details.length > 1 ? '↳ Side pots/excedentes calculados: o vencedor só recebe o valor que podia disputar.' : null,
    ].filter(Boolean).join('\n'),
    mentions: mentionIds(game.players),
  };
}

function showdownPoker(chatId, game) {
  while (game.community.length < 5) game.community.push(...draw(game.deck, 1));
  const evaluated = evaluatePokerContenders(game);
  const { payouts, details } = resolvePokerSidePots(game, evaluated);
  for (const [playerId, amount] of payouts.entries()) addZenies(playerId, amount);
  pokerGames.delete(chatId);

  const winners = [...payouts.entries()]
    .map(([playerId, amount]) => ({ player: game.players.find((item) => item.id === playerId), amount }))
    .filter((item) => item.player && item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    message: [
      '╭━━⪩ 🏆 *SHOWDOWN POKER* ⪨━━',
      '▢',
      `▢ • Mesa: ${cardsText(game.community)}`,
      `▢ • Pote total: *${money(game.pot)} Zenies*`,
      '▢',
      ...evaluated.map((item) => `▢ • ${mentionPlayer(item.player)}: ${item.result.label} — ${cardsText(item.result.cards)} | apostou: ${money(item.player.invested)}`),
      '▢',
      '▢ • Pagamentos:',
      ...(winners.length ? winners.map((item) => `▢   ${mentionPlayer(item.player)} recebeu *${money(item.amount)} Zenies*`) : ['▢   Nenhum pagamento calculado.']),
      details.length > 1 ? '▢' : null,
      details.length > 1 ? '▢ • Side pots aplicados: excedentes voltam para quem apostou acima do limite disputável.' : null,
      '╰━━─「♠️」─━━',
    ].filter(Boolean).join('\n'),
    mentions: mentionIds(game.players),
  };
}

function advancePokerStage(chatId, game) {
  const active = activePokerPlayers(game);
  if (active.length === 1) return finishPokerBySingleWinner(chatId, game, active[0], 'Todos os outros jogadores deram out.');
  const playable = playablePokerPlayers(game);
  if (playable.length === 0) return showdownPoker(chatId, game);

  let opened = '';
  if (game.stage === 'pré-flop') {
    game.community.push(...draw(game.deck, 3));
    game.stage = 'flop';
    opened = `🃏 *Flop aberto:* ${cardsText(game.community)}`;
  } else if (game.stage === 'flop') {
    game.community.push(...draw(game.deck, 1));
    game.stage = 'turn';
    opened = `🃏 *Turn aberto:* ${cardsText(game.community)}`;
  } else if (game.stage === 'turn') {
    game.community.push(...draw(game.deck, 1));
    game.stage = 'river';
    opened = `🃏 *River aberto:* ${cardsText(game.community)}`;
  } else if (game.stage === 'river') {
    return showdownPoker(chatId, game);
  }

  resetPokerBettingRound(game);
  const current = getPokerCurrentPlayer(game);
  return {
    message: [opened, '', current ? `🎯 Vez de ${mentionPlayer(current)}.` : null, '', formatPokerTable(game)].filter(Boolean).join('\n'),
    mentions: mentionIds(game.players),
  };
}

function finishPokerAction(chatId, game, actionMessage) {
  const active = activePokerPlayers(game);
  if (active.length === 1) {
    const finished = finishPokerBySingleWinner(chatId, game, active[0], 'Todos os outros jogadores deram out.');
    return { message: [actionMessage, '', finished.message].join('\n'), mentions: finished.mentions };
  }

  if (isPokerBettingRoundComplete(game)) {
    const advanced = advancePokerStage(chatId, game);
    return {
      message: [actionMessage, '', '✅ Todos os jogadores agiram. A mesa avançou automaticamente.', '', advanced.message].join('\n'),
      mentions: advanced.mentions,
    };
  }

  const next = setNextPokerTurn(game);
  return {
    message: [actionMessage, '', next ? `🎯 Agora é a vez de ${mentionPlayer(next)}.` : null, '', formatPokerTable(game)].filter(Boolean).join('\n'),
    mentions: mentionIds(game.players),
  };
}

async function sendPokerHands(client, game) {
  const failed = [];
  for (const player of game.players) {
    const sent = await sendPrivate(client, player.whatsapp_id, [
      '♠️ *Suas cartas no Poker DragonVerse*',
      '',
      `Mesa: ${game.community.length ? cardsText(game.community) : 'Ainda sem cartas abertas.'}`,
      `Suas cartas: *${cardsText(player.hand)}*`,
      '',
      'Não mostre suas cartas no grupo.',
    ].join('\n'));
    if (!sent) failed.push(player.phone);
  }
  return failed;
}

function pokerHelp() {
  return [
    '╭━━⪩ ♠️ *POKER DRAGONVERSE* ⪨━━',
    '▢',
    '▢ • */poker criar valor* — Cria mesa com entrada.',
    '▢ • */poker entrar* — Entra na mesa.',
    '▢ • */poker iniciar* — Distribui cartas no privado.',
    '▢',
    '▢ • Ações na sua vez:',
    '▢ • */check* ou */poker check* — Passa sem apostar.',
    '▢ • */cobrir* ou */poker cobrir* — Cobre a aposta atual.',
    '▢ • */poker apostar valor* — Aposta/aumenta a rodada.',
    '▢ • */allin* ou */poker allin* — Vai all-in.',
    '▢ • */out* ou */poker out* — Desiste da mão.',
    '▢',
    '▢ • Informações:',
    '▢ • */pote* ou */poker pote* — Mostra pote, mesa e vez.',
    '▢ • */poker cartas* — Reenvia suas cartas no privado.',
    '▢ • */sair* ou */poker sair* — Sai antes de iniciar; durante a partida vira out.',
    '▢',
    `▢ • Entrada mínima sugerida: *${money(MIN_CARD_BET)} Zenies*`,
    '╰━━─「♠️」─━━',
  ].join('\n');
}

async function poker(message, argsText = '', client) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const action = normalizeAction(firstToken(argsText));
  const rest = restAfterFirst(argsText);
  const chatId = message.from;
  let game = pokerGames.get(chatId);

  if (!action) return { ok: true, message: pokerHelp() };

  if (['criar', 'nova'].includes(action)) {
    if (game) return { ok: false, message: 'Já existe uma mesa de Poker ativa neste grupo.' };
    const buyIn = parseBet(rest, MIN_CARD_BET);
    const validation = requireRegisteredBalance(player, buyIn);
    if (!validation.ok) return { ok: false, message: `Use assim: */poker criar 1000000*\n${validation.message}` };
    removeZenies(player.id, buyIn);
    game = {
      chatId,
      status: 'waiting',
      createdBy: player.id,
      buyIn,
      pot: buyIn,
      currentBet: 0,
      currentTurnIndex: 0,
      stage: 'aguardando',
      deck: [],
      community: [],
      players: [createPokerPlayer(player)],
    };
    game.players[0].invested = buyIn;
    pokerGames.set(chatId, game);
    return {
      ok: true,
      message: ['♠️ *Mesa de Poker criada!*', '', `Entrada: *${money(buyIn)} Zenies*`, `Criador: ${mentionPlayer(game.players[0])}`, '', 'Use */poker entrar* para participar.', 'Depois use */poker iniciar* para começar.'].join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  if (!game) return { ok: false, message: 'Não existe mesa de Poker ativa. Use */poker criar valor*.' };

  if (['entrar', 'join'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa já começou.' };
    if (findPokerPlayer(game, player.id)) return { ok: false, message: 'Você já está nessa mesa.' };
    if (game.players.length >= 8) return { ok: false, message: 'A mesa já está cheia. Máximo: 8 jogadores.' };
    const fresh = getFreshPlayer(player);
    const validation = requireRegisteredBalance(fresh, game.buyIn);
    if (!validation.ok) return validation;
    removeZenies(player.id, game.buyIn);
    const pokerPlayer = createPokerPlayer(fresh);
    pokerPlayer.invested = game.buyIn;
    game.players.push(pokerPlayer);
    game.pot += game.buyIn;
    return { ok: true, message: `✅ ${mentionPlayer(pokerPlayer)} entrou na mesa. Pote atual: *${money(game.pot)} Zenies*.`, mentions: mentionIds(game.players) };
  }

  if (['iniciar', 'start'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa já foi iniciada.' };
    if (game.players.length < 2) return { ok: false, message: 'Poker precisa de pelo menos 2 jogadores.' };
    game.status = 'playing';
    game.stage = 'pré-flop';
    game.deck = createDeck();
    game.community = [];
    game.currentBet = 0;
    game.currentTurnIndex = 0;
    for (const pokerPlayer of game.players) {
      pokerPlayer.hand = draw(game.deck, 2);
      pokerPlayer.streetBet = 0;
      pokerPlayer.folded = false;
      pokerPlayer.allIn = false;
      pokerPlayer.acted = false;
    }
    const failed = await sendPokerHands(client, game);
    const current = getPokerCurrentPlayer(game);
    return {
      ok: true,
      message: ['♠️ *Poker iniciado!*', '', 'As cartas foram enviadas no privado de cada jogador.', failed.length ? `⚠️ Não consegui enviar privado para: ${failed.map((phone) => `@${phone}`).join(', ')}` : null, '', current ? `🎯 Primeira vez: ${mentionPlayer(current)}.` : null, '', formatPokerTable(game)].filter(Boolean).join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  if (['status', 'mesa', 'table', 'pote', 'pot'].includes(action)) return { ok: true, message: formatPokerTable(game), mentions: mentionIds(game.players) };

  const pokerPlayer = findPokerPlayer(game, player.id);
  if (!pokerPlayer) return { ok: false, message: 'Você não está nessa mesa de Poker.' };

  if (['cartas', 'mao', 'mão'].includes(action)) {
    const sent = await sendPrivate(client, pokerPlayer.whatsapp_id, ['♠️ *Suas cartas no Poker DragonVerse*', '', `Mesa: ${game.community.length ? cardsText(game.community) : 'Ainda sem cartas abertas.'}`, `Suas cartas: *${cardsText(pokerPlayer.hand)}*`].join('\n'));
    return { ok: sent, message: sent ? '✅ Enviei suas cartas no privado.' : 'Não consegui enviar suas cartas no privado.' };
  }

  if (['sair', 'leave'].includes(action) && game.status === 'waiting') {
    addZenies(pokerPlayer.id, pokerPlayer.invested, { skipReferral: true });
    game.pot -= pokerPlayer.invested;
    game.players = game.players.filter((item) => item.id !== pokerPlayer.id);
    if (game.players.length === 0) pokerGames.delete(chatId);
    return { ok: true, message: `🚪 ${mentionPlayer(pokerPlayer)} saiu da mesa e recebeu *${money(pokerPlayer.invested)} Zenies* de volta.`, mentions: mentionIds(game.players.concat([pokerPlayer])) };
  }

  if (game.status !== 'playing') return { ok: false, message: 'A mesa ainda não começou.' };
  if (pokerPlayer.folded) return { ok: false, message: 'Você já está out nessa mão.' };

  const current = getPokerCurrentPlayer(game);
  if (current && current.id !== pokerPlayer.id && !['pote', 'status', 'mesa', 'table'].includes(action)) {
    return { ok: false, message: `Ainda não é sua vez. Agora é a vez de ${mentionPlayer(current)}.`, mentions: mentionIds(game.players) };
  }

  if (['check', 'passar'].includes(action)) {
    if (pokerPlayer.streetBet !== game.currentBet) return { ok: false, message: `Você precisa cobrir *${money(game.currentBet - pokerPlayer.streetBet)} Zenies* ou dar out.` };
    pokerPlayer.acted = true;
    return { ok: true, ...finishPokerAction(chatId, game, `✅ ${mentionPlayer(pokerPlayer)} deu *check*.`) };
  }

  if (['cobrir', 'call', 'pagar'].includes(action)) {
    const amount = game.currentBet - pokerPlayer.streetBet;
    if (amount <= 0) {
      pokerPlayer.acted = true;
      return { ok: true, ...finishPokerAction(chatId, game, `✅ ${mentionPlayer(pokerPlayer)} deu *check*.`) };
    }
    const fresh = getFreshPlayer(player);
    if (Number(fresh.zenies || 0) < amount) return { ok: false, message: `Saldo insuficiente para cobrir. Falta cobrir *${money(amount)} Zenies*. Use */allin* ou */out*.` };
    removeZenies(player.id, amount);
    pokerPlayer.invested += amount;
    pokerPlayer.streetBet += amount;
    pokerPlayer.acted = true;
    game.pot += amount;
    return { ok: true, ...finishPokerAction(chatId, game, `💰 ${mentionPlayer(pokerPlayer)} cobriu *${money(amount)} Zenies*.`) };
  }

  if (['apostar', 'aumentar', 'raise'].includes(action)) {
    const amount = parseBet(rest);
    const fresh = getFreshPlayer(player);
    const validation = requireRegisteredBalance(fresh, amount);
    if (!validation.ok) return { ok: false, message: `Use assim: */poker apostar 1000000*\n${validation.message}` };
    removeZenies(player.id, amount);
    pokerPlayer.invested += amount;
    pokerPlayer.streetBet += amount;
    pokerPlayer.acted = true;
    game.pot += amount;
    if (pokerPlayer.streetBet > game.currentBet) {
      game.currentBet = pokerPlayer.streetBet;
      for (const other of game.players) if (!other.folded && !other.allIn && other.id !== pokerPlayer.id) other.acted = false;
    }
    return { ok: true, ...finishPokerAction(chatId, game, `💰 ${mentionPlayer(pokerPlayer)} apostou/aumentou *${money(amount)} Zenies*.`) };
  }

  if (['allin', 'all-in', 'all', 'allwin', 'all win'].includes(action)) {
    const fresh = getFreshPlayer(player);
    const amount = Number(fresh.zenies || 0);
    if (amount <= 0) return { ok: false, message: 'Você não tem Zenies para ir all-in.' };
    removeZenies(player.id, amount);
    pokerPlayer.invested += amount;
    pokerPlayer.streetBet += amount;
    pokerPlayer.allIn = true;
    pokerPlayer.acted = true;
    game.pot += amount;
    if (pokerPlayer.streetBet > game.currentBet) {
      game.currentBet = pokerPlayer.streetBet;
      for (const other of game.players) if (!other.folded && !other.allIn && other.id !== pokerPlayer.id) other.acted = false;
    }
    return { ok: true, ...finishPokerAction(chatId, game, `🔥 ${mentionPlayer(pokerPlayer)} foi *ALL-IN* com *${money(amount)} Zenies*!`) };
  }

  if (['desistir', 'fold', 'correr', 'out', 'sair'].includes(action)) {
    pokerPlayer.folded = true;
    pokerPlayer.acted = true;
    return { ok: true, ...finishPokerAction(chatId, game, `🚪 ${mentionPlayer(pokerPlayer)} deu *out* e saiu da mão.`) };
  }

  if (['cancelar'].includes(action)) {
    if (player.id !== game.createdBy) return { ok: false, message: 'Apenas quem criou a mesa pode cancelar.' };
    pokerGames.delete(chatId);
    return { ok: true, message: 'Mesa de Poker cancelada. Valores já apostados não são devolvidos.' };
  }

  return { ok: false, message: 'Ação de Poker inválida. Use */regras poker*.' };
}

// =========================
// Truco Paulista limpo com aposta e pontuação até 12
// =========================

function createTrucoPlayer(player) {
  return {
    id: player.id,
    whatsapp_id: player.whatsapp_id,
    phone: player.phone,
    hand: [],
    team: null,
  };
}

function findTrucoPlayer(game, playerId) {
  return game.players.find((item) => item.id === playerId);
}

function nextTrucoRank(rank) {
  const index = TRUCO_RANKS_LOW_TO_HIGH.indexOf(rank);
  if (index === -1) return '4';
  return TRUCO_RANKS_LOW_TO_HIGH[(index + 1) % TRUCO_RANKS_LOW_TO_HIGH.length];
}

function trucoCardPower(card, manilhaRank) {
  if (card.rank === manilhaRank) return 100 + Number(card.trucoPower || 0);
  return TRUCO_RANKS_LOW_TO_HIGH.indexOf(card.rank) + 1;
}

function formatTrucoHand(player) {
  return player.hand.map((card, index) => `${index + 1}) ${cardText(card)}`).join('\n');
}

function assignTrucoTeams(game) {
  if (game.players.length === 2) {
    game.players[0].team = 1;
    game.players[1].team = 2;
    return;
  }
  const shuffled = shuffle(game.players);
  shuffled[0].team = 1;
  shuffled[1].team = 2;
  shuffled[2].team = 1;
  shuffled[3].team = 2;
}

function currentTrucoPlayer(game) {
  return game.players[game.currentTurnIndex] || null;
}

function nextTrucoTurn(game) {
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length;
  return currentTrucoPlayer(game);
}

function formatTrucoTable(game) {
  const current = currentTrucoPlayer(game);
  return [
    '╭━━⪩ 🃏 *TRUCO PAULISTA LIMPO* ⪨━━',
    '▢',
    `▢ • Entrada: *${money(game.buyIn)} Zenies*`,
    `▢ • Pote: *${money(game.pot)} Zenies*`,
    `▢ • Placar: Time 1 *${game.score[1]}* x *${game.score[2]}* Time 2`,
    `▢ • Valor da mão: *${game.handValue}*`,
    game.vira ? `▢ • Vira: *${cardText(game.vira)}*` : '▢ • Vira: ainda não saiu.',
    game.manilhaRank ? `▢ • Manilha: *${game.manilhaRank}*` : '▢ • Manilha: ainda não definida.',
    current ? `▢ • Vez de: ${mentionPlayer(current)} — Time ${current.team}` : null,
    '▢',
    '▢ • Times:',
    `▢   Time 1: ${splitByTeam(game, 1).map(mentionPlayer).join(' + ')}`,
    `▢   Time 2: ${splitByTeam(game, 2).map(mentionPlayer).join(' + ')}`,
    game.roundCards?.length ? '▢' : null,
    game.roundCards?.length ? `▢ • Cartas na mesa: ${game.roundCards.map((item) => `${mentionPlayer(item.player)}: ${cardText(item.card)}`).join(' | ')}` : null,
    '╰━━─「🃏」─━━',
  ].filter(Boolean).join('\n');
}

async function sendTrucoHands(client, game) {
  const failed = [];
  for (const player of game.players) {
    const sent = await sendPrivate(client, player.whatsapp_id, [
      '🃏 *Suas cartas no Truco DragonVerse*',
      '',
      `Time: *${player.team}*`,
      `Vira: *${cardText(game.vira)}*`,
      `Manilha: *${game.manilhaRank}*`,
      '',
      formatTrucoHand(player),
      '',
      'Use no grupo: */truco jogar 1*',
    ].join('\n'));
    if (!sent) failed.push(player.phone);
  }
  return failed;
}

function nextTrucoRaise(current) {
  if (current < 3) return 3;
  if (current < 6) return 6;
  if (current < 9) return 9;
  if (current < 12) return 12;
  return 12;
}

async function dealNewTrucoHand(game, client, starterIndex = null) {
  game.deck = createDeck(TRUCO_DECK_RANKS);
  for (const player of game.players) player.hand = draw(game.deck, 3);
  game.vira = draw(game.deck, 1)[0];
  game.manilhaRank = nextTrucoRank(game.vira.rank);
  game.handValue = 1;
  game.roundCards = [];
  game.roundWins = { 1: 0, 2: 0 };
  game.roundNumber = 1;
  if (starterIndex !== null) game.currentTurnIndex = starterIndex;
  const failed = await sendTrucoHands(client, game);
  return failed;
}

function payTrucoWinners(chatId, game, winningTeam) {
  const winners = splitByTeam(game, winningTeam);
  const prizeEach = Math.floor(game.pot / winners.length);
  for (const player of winners) addZenies(player.id, prizeEach);
  trucoGames.delete(chatId);
  return {
    ok: true,
    message: [
      '🏆 *Truco encerrado!*',
      '',
      `Time ${winningTeam} venceu por *${game.score[winningTeam]}* pontos.`,
      `Vencedores: ${winners.map(mentionPlayer).join(' + ')}`,
      `Prêmio para cada um: *${money(prizeEach)} Zenies*`,
    ].join('\n'),
    mentions: mentionIds(game.players),
  };
}

async function finishTrucoRound(chatId, game, client) {
  const sorted = [...game.roundCards].sort((a, b) => trucoCardPower(b.card, game.manilhaRank) - trucoCardPower(a.card, game.manilhaRank));
  const winner = sorted[0];
  game.roundWins[winner.player.team] = (game.roundWins[winner.player.team] || 0) + 1;
  const wonRounds = Number(game.roundWins[winner.player.team] || 0);
  const baseLines = [
    '🏁 *Rodada do Truco encerrada!*',
    '',
    `Cartas: ${game.roundCards.map((item) => `${mentionPlayer(item.player)} ${cardText(item.card)}`).join(' | ')}`,
    `Vencedor da rodada: ${mentionPlayer(winner.player)} — Time ${winner.player.team}`,
  ];

  game.roundCards = [];
  game.roundNumber += 1;
  game.currentTurnIndex = game.players.indexOf(winner.player);

  if (wonRounds >= 2 || game.roundNumber > 3) {
    game.score[winner.player.team] += game.handValue;
    baseLines.push('', `🟢 Time ${winner.player.team} venceu a mão e ganhou *${game.handValue}* ponto(s).`);
    baseLines.push(`Placar: Time 1 *${game.score[1]}* x *${game.score[2]}* Time 2`);

    if (game.score[winner.player.team] >= TRUCO_TARGET_POINTS) {
      const paid = payTrucoWinners(chatId, game, winner.player.team);
      return { ok: true, message: [baseLines.join('\n'), '', paid.message].join('\n'), mentions: paid.mentions };
    }

    const failed = await dealNewTrucoHand(game, client, game.currentTurnIndex);
    const current = currentTrucoPlayer(game);
    return {
      ok: true,
      message: [
        baseLines.join('\n'),
        '',
        '🔄 Nova mão distribuída automaticamente.',
        failed.length ? `⚠️ Não consegui enviar privado para: ${failed.map((phone) => `@${phone}`).join(', ')}` : null,
        '',
        `🎯 Vez de ${mentionPlayer(current)}.`,
        '',
        formatTrucoTable(game),
      ].filter(Boolean).join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  const current = currentTrucoPlayer(game);
  return {
    ok: true,
    message: [baseLines.join('\n'), '', `🎯 Próxima rodada. Vez de ${mentionPlayer(current)}.`, '', formatTrucoTable(game)].join('\n'),
    mentions: mentionIds(game.players),
  };
}

async function truco(message, argsText = '', client) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const action = normalizeAction(firstToken(argsText));
  const rest = restAfterFirst(argsText);
  const chatId = message.from;
  let game = trucoGames.get(chatId);

  if (!action) return { ok: true, message: trucoRules() };

  if (['criar', 'nova'].includes(action)) {
    if (game) return { ok: false, message: 'Já existe uma mesa de Truco ativa neste grupo.' };
    const buyIn = parseBet(rest);
    const validation = requireRegisteredBalance(player, buyIn);
    if (!validation.ok) return { ok: false, message: `Use assim: */truco criar 1000000*\n${validation.message}` };

    removeZenies(player.id, buyIn);
    const trucoPlayer = createTrucoPlayer(player);
    game = {
      chatId,
      status: 'waiting',
      createdBy: player.id,
      buyIn,
      pot: buyIn,
      players: [trucoPlayer],
      deck: [],
      vira: null,
      manilhaRank: null,
      handValue: 1,
      roundNumber: 1,
      currentTurnIndex: 0,
      roundCards: [],
      roundWins: { 1: 0, 2: 0 },
      score: { 1: 0, 2: 0 },
    };
    trucoGames.set(chatId, game);

    return {
      ok: true,
      message: [`🃏 *Mesa de Truco criada!*`, '', `Entrada: *${money(buyIn)} Zenies*`, `Criador: ${mentionPlayer(trucoPlayer)}`, '', 'Use */truco entrar* para participar. A mesa pode iniciar com 2 ou 4 jogadores.'].join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  if (!game) return { ok: false, message: 'Não existe mesa de Truco ativa. Use */truco criar valor*.' };

  if (['entrar', 'join'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa já começou.' };
    if (findTrucoPlayer(game, player.id)) return { ok: false, message: 'Você já está nessa mesa.' };
    if (game.players.length >= 4) return { ok: false, message: 'Mesa cheia. Máximo: 4 jogadores.' };
    const fresh = getFreshPlayer(player);
    const validation = requireRegisteredBalance(fresh, game.buyIn);
    if (!validation.ok) return validation;
    removeZenies(player.id, game.buyIn);
    const trucoPlayer = createTrucoPlayer(fresh);
    game.players.push(trucoPlayer);
    game.pot += game.buyIn;
    return { ok: true, message: `✅ ${mentionPlayer(trucoPlayer)} entrou na mesa de Truco. Jogadores: *${game.players.length}/4*.`, mentions: mentionIds(game.players) };
  }

  if (['iniciar', 'start'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa já foi iniciada.' };
    if (player.id !== game.createdBy) return { ok: false, message: 'Apenas quem criou a mesa pode iniciar.' };
    if (![2, 4].includes(game.players.length)) return { ok: false, message: 'Truco precisa iniciar com *2 ou 4 jogadores*.' };
    game.status = 'playing';
    assignTrucoTeams(game);
    game.currentTurnIndex = Math.floor(Math.random() * game.players.length);
    const failed = await dealNewTrucoHand(game, client, game.currentTurnIndex);
    const current = currentTrucoPlayer(game);
    return {
      ok: true,
      message: ['🃏 *Truco iniciado!*', '', `Vira: *${cardText(game.vira)}*`, `Manilha: *${game.manilhaRank}*`, '', 'Times sorteados:', `Time 1: ${splitByTeam(game, 1).map(mentionPlayer).join(' + ')}`, `Time 2: ${splitByTeam(game, 2).map(mentionPlayer).join(' + ')}`, '', failed.length ? `⚠️ Não consegui enviar privado para: ${failed.map((phone) => `@${phone}`).join(', ')}` : null, `🎯 Primeira vez: ${mentionPlayer(current)}.`, '', formatTrucoTable(game)].filter(Boolean).join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  const trucoPlayer = findTrucoPlayer(game, player.id);
  if (!trucoPlayer) return { ok: false, message: 'Você não está nessa mesa de Truco.' };

  if (['status', 'mesa'].includes(action)) return { ok: true, message: formatTrucoTable(game), mentions: mentionIds(game.players) };

  if (['cartas', 'mao', 'mão'].includes(action)) {
    const sent = await sendPrivate(client, trucoPlayer.whatsapp_id, ['🃏 *Suas cartas no Truco DragonVerse*', '', `Time: *${trucoPlayer.team}*`, `Vira: *${cardText(game.vira)}*`, `Manilha: *${game.manilhaRank}*`, '', formatTrucoHand(trucoPlayer)].join('\n'));
    return { ok: sent, message: sent ? '✅ Enviei suas cartas no privado.' : 'Não consegui enviar suas cartas no privado.' };
  }

  if (game.status !== 'playing') return { ok: false, message: 'A mesa ainda não começou.' };

  if (['truco', 'seis', '6', 'nove', '9', 'doze', '12'].includes(action)) {
    let requested = nextTrucoRaise(game.handValue);
    if (['seis', '6'].includes(action)) requested = 6;
    if (['nove', '9'].includes(action)) requested = 9;
    if (['doze', '12'].includes(action)) requested = 12;
    if (requested <= game.handValue) return { ok: false, message: `A mão já está valendo *${game.handValue}*.` };
    game.handValue = requested;
    return { ok: true, message: `🔥 ${mentionPlayer(trucoPlayer)} aumentou a mão para *${game.handValue}*!`, mentions: mentionIds(game.players) };
  }

  if (['jogar', 'usar'].includes(action)) {
    const current = currentTrucoPlayer(game);
    if (current && current.id !== trucoPlayer.id) return { ok: false, message: `Ainda não é sua vez. Agora é a vez de ${mentionPlayer(current)}.`, mentions: mentionIds(game.players) };
    const selected = Number(firstToken(rest));
    if (!Number.isInteger(selected) || selected < 1 || selected > trucoPlayer.hand.length) return { ok: false, message: 'Use assim: */truco jogar 1*' };
    if (game.roundCards.some((item) => item.player.id === player.id)) return { ok: false, message: 'Você já jogou uma carta nesta rodada.' };

    const [card] = trucoPlayer.hand.splice(selected - 1, 1);
    game.roundCards.push({ player: trucoPlayer, card });

    if (game.roundCards.length >= game.players.length) return finishTrucoRound(chatId, game, client);

    const next = nextTrucoTurn(game);
    return {
      ok: true,
      message: [`🃏 ${mentionPlayer(trucoPlayer)} jogou *${cardText(card)}*.`, '', `🎯 Agora é a vez de ${mentionPlayer(next)}.`, '', `Cartas na mesa: ${game.roundCards.map((item) => `${mentionPlayer(item.player)} ${cardText(item.card)}`).join(' | ')}`].join('\n'),
      mentions: mentionIds(game.players),
    };
  }

  if (['cancelar'].includes(action)) {
    if (player.id !== game.createdBy) return { ok: false, message: 'Apenas quem criou a mesa pode cancelar.' };
    trucoGames.delete(chatId);
    return { ok: true, message: 'Mesa de Truco cancelada. Apostas já colocadas não são devolvidas.' };
  }

  return { ok: false, message: 'Ação de Truco inválida. Use */regras truco*.' };
}

function jogosStatus() {
  return {
    blackjack: blackjackGames.size,
    poker: pokerGames.size,
    truco: trucoGames.size,
  };
}

module.exports = {
  blackjack,
  poker,
  truco,
  regrasCartas,
  jogosStatus,
};
