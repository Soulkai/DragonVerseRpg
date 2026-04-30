const db = require('../database/db');
const { parseAmount } = require('../utils/numbers');
const { money } = require('../utils/format');
const { normalizeText } = require('../utils/text');
const { getOrCreatePlayerFromMessage, getPlayerByWhatsAppId } = require('./playerService');

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

function keyForPlayerGame(chatId, playerId) {
  return `${chatId}:${playerId}`;
}

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

function addZenies(playerId, amount) {
  db.prepare(`
    UPDATE players
    SET zenies = zenies + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, playerId);
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
      message: `Aposta mínima: *${money(MIN_CARD_BET)} Zenies*.`
    };
  }

  if (Number(player.zenies || 0) < amount) {
    return {
      ok: false,
      message: `Saldo insuficiente. Você tem *${money(player.zenies)} Zenies*.`
    };
  }

  return { ok: true };
}

// =========================
// Blackjack
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

function formatBlackjackState(game, revealDealer = false) {
  const dealerCards = revealDealer ? cardsText(game.dealerHand) : `${cardText(game.dealerHand[0])}  🂠`;
  const dealerScore = revealDealer ? blackjackScore(game.dealerHand) : blackjackScore([game.dealerHand[0]]);

  return [
    '╭━━⪩ 🃏 *BLACKJACK DRAGONVERSE* ⪨━━',
    '▢',
    `▢ • Jogador: @${game.player.phone}`,
    `▢ • Aposta: *${money(game.bet)} Zenies*`,
    '▢',
    `▢ • Suas cartas: ${cardsText(game.playerHand)}`,
    `▢ • Sua pontuação: *${blackjackScore(game.playerHand)}*`,
    '▢',
    `▢ • Mesa: ${dealerCards}`,
    `▢ • Pontuação da mesa: *${dealerScore}*`,
    '▢',
    revealDealer ? null : '▢ • Comandos: */blackjack carta*, */blackjack parar*, */blackjack dobrar*',
    '╰━━─「🃏」─━━',
  ].filter(Boolean).join('\n');
}

function settleBlackjack(game, reason = null) {
  while (blackjackScore(game.dealerHand) < 17) {
    game.dealerHand.push(...draw(game.deck, 1));
  }

  const playerScore = blackjackScore(game.playerHand);
  const dealerScore = blackjackScore(game.dealerHand);
  const naturalBlackjack = game.playerHand.length === 2 && playerScore === 21;

  let title = '💀 *Derrota.*';
  let payout = 0;
  let description = 'Você perdeu sua aposta.';

  if (playerScore > 21) {
    title = '💥 *Estourou!*';
    description = 'Você passou de 21 e perdeu sua aposta.';
  } else if (dealerScore > 21) {
    title = '✅ *Vitória!*';
    payout = game.bet * 2;
    description = 'A mesa estourou. Você venceu.';
  } else if (naturalBlackjack && dealerScore !== 21) {
    title = '🌟 *Blackjack natural!*';
    payout = Math.floor(game.bet * 2.5);
    description = 'Você fez Blackjack natural e recebeu 2.5x.';
  } else if (playerScore > dealerScore) {
    title = '✅ *Vitória!*';
    payout = game.bet * 2;
    description = 'Sua pontuação venceu a mesa.';
  } else if (playerScore === dealerScore) {
    title = '⚖️ *Empate.*';
    payout = game.bet;
    description = 'Sua aposta foi devolvida.';
  }

  if (payout > 0) addZenies(game.player.id, payout);
  const updated = getFreshPlayer(game.player);

  return [
    formatBlackjackState(game, true),
    '',
    reason ? `${reason}\n` : null,
    title,
    description,
    payout > 0 ? `💰 Recebido: *${money(payout)} Zenies*` : null,
    `💼 Saldo atual: *${money(updated.zenies)} Zenies*`,
  ].filter(Boolean).join('\n');
}

async function blackjack(message, argsText = '') {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const actionRaw = firstToken(argsText);
  const action = normalizeAction(actionRaw);
  const gameKey = keyForPlayerGame(message.from, player.id);

  if (!action) {
    return {
      ok: true,
      message: [
        '╭━━⪩ 🃏 *BLACKJACK* ⪨━━',
        '▢',
        '▢ • */blackjack iniciar valor* — Começa contra a mesa.',
        '▢ • */blackjack carta* — Pede mais uma carta.',
        '▢ • */blackjack parar* — Para e deixa a mesa jogar.',
        '▢ • */blackjack dobrar* — Dobra a aposta, compra 1 carta e para.',
        '▢',
        `▢ • Aposta mínima: *${money(MIN_CARD_BET)} Zenies*`,
        '╰━━─「🃏」─━━',
      ].join('\n'),
    };
  }

  if (['iniciar', 'criar', 'jogar', 'apostar'].includes(action) || parseAmount(actionRaw)) {
    if (blackjackGames.has(gameKey)) {
      return { ok: false, message: 'Você já tem um Blackjack ativo neste chat.' };
    }

    const betText = parseAmount(actionRaw) ? argsText : restAfterFirst(argsText);
    const bet = parseBet(betText);
    const validation = requireRegisteredBalance(player, bet);
    if (!validation.ok) {
      return {
        ok: false,
        message: `Use assim: */blackjack iniciar 1000000*\n${validation.message}`,
      };
    }

    removeZenies(player.id, bet);
    const deck = createDeck();
    const game = {
      chatId: message.from,
      player,
      deck,
      bet,
      playerHand: draw(deck, 2),
      dealerHand: draw(deck, 2),
    };

    blackjackGames.set(gameKey, game);

    if (blackjackScore(game.playerHand) === 21) {
      blackjackGames.delete(gameKey);
      return { ok: true, message: settleBlackjack(game) };
    }

    return { ok: true, message: formatBlackjackState(game) };
  }

  const game = blackjackGames.get(gameKey);
  if (!game) {
    return { ok: false, message: 'Você não tem Blackjack ativo. Use */blackjack iniciar valor*.' };
  }

  if (['status', 'mesa'].includes(action)) {
    return { ok: true, message: formatBlackjackState(game) };
  }

  if (['carta', 'hit', 'pedir', 'comprar'].includes(action)) {
    game.playerHand.push(...draw(game.deck, 1));
    if (blackjackScore(game.playerHand) > 21) {
      blackjackGames.delete(gameKey);
      return { ok: true, message: settleBlackjack(game) };
    }

    return { ok: true, message: formatBlackjackState(game) };
  }

  if (['dobrar', 'double'].includes(action)) {
    const fresh = getFreshPlayer(player);
    if (Number(fresh.zenies || 0) < game.bet) {
      return { ok: false, message: `Saldo insuficiente para dobrar. Você precisa de mais *${money(game.bet)} Zenies*.` };
    }

    removeZenies(player.id, game.bet);
    game.bet *= 2;
    game.playerHand.push(...draw(game.deck, 1));
    blackjackGames.delete(gameKey);
    return { ok: true, message: settleBlackjack(game, '⚡ Você dobrou a aposta.') };
  }

  if (['parar', 'stand', 'ficar'].includes(action)) {
    blackjackGames.delete(gameKey);
    return { ok: true, message: settleBlackjack(game) };
  }

  if (['cancelar', 'sair'].includes(action)) {
    blackjackGames.delete(gameKey);
    return { ok: true, message: 'Blackjack cancelado. A aposta já colocada na mesa não é devolvida.' };
  }

  return { ok: false, message: 'Ação de Blackjack inválida. Use */blackjack* para ver os comandos.' };
}

// =========================
// Poker Texas Hold'em simplificado
// =========================

function createPokerPlayer(player) {
  return {
    id: player.id,
    whatsapp_id: player.whatsapp_id,
    phone: player.phone,
    display_name: player.display_name,
    hand: [],
    invested: 0,
    folded: false,
    allIn: false,
  };
}

function findPokerPlayer(game, playerId) {
  return game.players.find((item) => item.id === playerId);
}

function formatPokerTable(game) {
  const status = game.status === 'waiting' ? 'Aguardando jogadores' : 'Em andamento';
  const activePlayers = game.players.filter((player) => !player.folded).length;

  return [
    '╭━━⪩ ♠️ *POKER DRAGONVERSE* ⪨━━',
    '▢',
    `▢ • Status: *${status}*`,
    `▢ • Entrada: *${money(game.buyIn)} Zenies*`,
    `▢ • Pote: *${money(game.pot)} Zenies*`,
    `▢ • Jogadores ativos: *${activePlayers}/${game.players.length}*`,
    `▢ • Etapa: *${game.stage}*`,
    '▢',
    `▢ • Mesa: ${game.community.length ? cardsText(game.community) : 'Nenhuma carta aberta ainda.'}`,
    '▢',
    '▢ • Jogadores:',
    ...game.players.map((player, index) => `▢   ${index + 1}. @${player.phone} ${player.folded ? '— desistiu' : player.allIn ? '— all-in' : ''}`),
    '╰━━─「♠️」─━━',
  ].join('\n');
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

function finishPokerBySingleWinner(chatId, game, winner, reason) {
  addZenies(winner.id, game.pot);
  pokerGames.delete(chatId);

  return [
    '🏆 *Poker encerrado!*',
    '',
    reason,
    `Vencedor: @${winner.phone}`,
    `Pote recebido: *${money(game.pot)} Zenies*`,
  ].join('\n');
}

function showdownPoker(chatId, game) {
  const contenders = game.players.filter((player) => !player.folded);
  const evaluated = contenders.map((player) => ({
    player,
    result: evaluateBestHand([...player.hand, ...game.community]),
  }));

  evaluated.sort((a, b) => compareRankArrays(b.result.score, a.result.score));
  const bestScore = evaluated[0].result.score;
  const winners = evaluated.filter((item) => compareRankArrays(item.result.score, bestScore) === 0);
  const split = Math.floor(game.pot / winners.length);

  for (const winner of winners) {
    addZenies(winner.player.id, split);
  }

  pokerGames.delete(chatId);

  return [
    '╭━━⪩ 🏆 *SHOWDOWN POKER* ⪨━━',
    '▢',
    `▢ • Mesa: ${cardsText(game.community)}`,
    `▢ • Pote: *${money(game.pot)} Zenies*`,
    '▢',
    ...evaluated.map((item) => `▢ • @${item.player.phone}: ${item.result.label} — ${cardsText(item.result.cards)}`),
    '▢',
    winners.length === 1
      ? `▢ • Vencedor: @${winners[0].player.phone}`
      : `▢ • Empate: ${winners.map((item) => `@${item.player.phone}`).join(', ')}`,
    `▢ • Prêmio: *${money(split)} Zenies* para cada vencedor.`,
    '╰━━─「♠️」─━━',
  ].join('\n');
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

async function poker(message, argsText = '', client) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const action = normalizeAction(firstToken(argsText));
  const rest = restAfterFirst(argsText);
  const chatId = message.from;
  let game = pokerGames.get(chatId);

  if (!action) {
    return {
      ok: true,
      message: [
        '╭━━⪩ ♠️ *POKER DRAGONVERSE* ⪨━━',
        '▢',
        '▢ • */poker criar valor* — Cria mesa com entrada.',
        '▢ • */poker entrar* — Entra na mesa.',
        '▢ • */poker iniciar* — Distribui cartas no privado.',
        '▢ • */poker apostar valor* — Aumenta a aposta e o pote.',
        '▢ • */poker allin* — Vai all-in.',
        '▢ • */poker mesa* — Abre flop, turn, river e showdown.',
        '▢ • */poker desistir* — Desiste da mão.',
        '▢ • */poker cartas* — Reenvia suas cartas no privado.',
        '▢',
        `▢ • Entrada mínima sugerida: *${money(MIN_CARD_BET)} Zenies*`,
        '╰━━─「♠️」─━━',
      ].join('\n'),
    };
  }

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
      stage: 'aguardando',
      deck: [],
      community: [],
      players: [createPokerPlayer(player)],
    };
    game.players[0].invested = buyIn;
    pokerGames.set(chatId, game);

    return {
      ok: true,
      message: [
        '♠️ *Mesa de Poker criada!*',
        '',
        `Entrada: *${money(buyIn)} Zenies*`,
        `Criador: @${player.phone}`,
        '',
        'Use */poker entrar* para participar.',
        'Depois use */poker iniciar* para começar.',
      ].join('\n'),
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

    return { ok: true, message: `✅ @${fresh.phone} entrou na mesa. Pote atual: *${money(game.pot)} Zenies*.` };
  }

  if (['iniciar', 'start'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa já foi iniciada.' };
    if (game.players.length < 2) return { ok: false, message: 'Poker precisa de pelo menos 2 jogadores.' };

    game.status = 'playing';
    game.stage = 'pré-flop';
    game.deck = createDeck();
    for (const pokerPlayer of game.players) {
      pokerPlayer.hand = draw(game.deck, 2);
    }

    const failed = await sendPokerHands(client, game);
    return {
      ok: true,
      message: [
        '♠️ *Poker iniciado!*',
        '',
        'As cartas foram enviadas no privado de cada jogador.',
        failed.length ? `⚠️ Não consegui enviar privado para: ${failed.map((phone) => `@${phone}`).join(', ')}` : null,
        '',
        formatPokerTable(game),
      ].filter(Boolean).join('\n'),
    };
  }

  if (['status', 'mesa', 'table'].includes(action) && game.status === 'waiting') {
    return { ok: true, message: formatPokerTable(game) };
  }

  const pokerPlayer = findPokerPlayer(game, player.id);
  if (!pokerPlayer) return { ok: false, message: 'Você não está nessa mesa de Poker.' };

  if (['cartas', 'mao', 'mão'].includes(action)) {
    const sent = await sendPrivate(client, pokerPlayer.whatsapp_id, [
      '♠️ *Suas cartas no Poker DragonVerse*',
      '',
      `Mesa: ${game.community.length ? cardsText(game.community) : 'Ainda sem cartas abertas.'}`,
      `Suas cartas: *${cardsText(pokerPlayer.hand)}*`,
    ].join('\n'));
    return { ok: sent, message: sent ? '✅ Enviei suas cartas no privado.' : 'Não consegui enviar suas cartas no privado.' };
  }

  if (game.status !== 'playing') return { ok: false, message: 'A mesa ainda não começou.' };
  if (pokerPlayer.folded) return { ok: false, message: 'Você já desistiu dessa mão.' };

  if (['apostar', 'aumentar', 'raise'].includes(action)) {
    const amount = parseBet(rest);
    const fresh = getFreshPlayer(player);
    const validation = requireRegisteredBalance(fresh, amount);
    if (!validation.ok) return { ok: false, message: `Use assim: */poker apostar 1000000*\n${validation.message}` };

    removeZenies(player.id, amount);
    pokerPlayer.invested += amount;
    game.pot += amount;
    game.currentBet = Math.max(game.currentBet, amount);

    return { ok: true, message: `💰 @${player.phone} aumentou a aposta em *${money(amount)} Zenies*.\nPote atual: *${money(game.pot)} Zenies*.` };
  }

  if (['allin', 'all-in', 'all', 'allwin', 'all win'].includes(action)) {
    const fresh = getFreshPlayer(player);
    const amount = Number(fresh.zenies || 0);
    if (amount <= 0) return { ok: false, message: 'Você não tem Zenies para ir all-in.' };

    removeZenies(player.id, amount);
    pokerPlayer.invested += amount;
    pokerPlayer.allIn = true;
    game.pot += amount;

    return { ok: true, message: `🔥 @${player.phone} foi *ALL-IN* com *${money(amount)} Zenies*!\nPote atual: *${money(game.pot)} Zenies*.` };
  }

  if (['desistir', 'fold', 'correr'].includes(action)) {
    pokerPlayer.folded = true;
    const active = game.players.filter((item) => !item.folded);
    if (active.length === 1) {
      return { ok: true, message: finishPokerBySingleWinner(chatId, game, active[0], 'Todos os outros jogadores desistiram.') };
    }

    return { ok: true, message: `🚪 @${player.phone} desistiu da mão. Jogadores restantes: *${active.length}*.` };
  }

  if (['mesa', 'proxima', 'próxima', 'abrir'].includes(action)) {
    if (game.stage === 'pré-flop') {
      game.community.push(...draw(game.deck, 3));
      game.stage = 'flop';
      return { ok: true, message: `🃏 *Flop aberto!*\n\nMesa: ${cardsText(game.community)}\n\n${formatPokerTable(game)}` };
    }
    if (game.stage === 'flop') {
      game.community.push(...draw(game.deck, 1));
      game.stage = 'turn';
      return { ok: true, message: `🃏 *Turn aberto!*\n\nMesa: ${cardsText(game.community)}\n\n${formatPokerTable(game)}` };
    }
    if (game.stage === 'turn') {
      game.community.push(...draw(game.deck, 1));
      game.stage = 'river';
      return { ok: true, message: `🃏 *River aberto!*\n\nMesa: ${cardsText(game.community)}\n\nUse */poker mesa* novamente para o showdown.` };
    }
    if (game.stage === 'river') {
      return { ok: true, message: showdownPoker(chatId, game) };
    }
  }

  if (['cancelar'].includes(action)) {
    if (player.id !== game.createdBy) return { ok: false, message: 'Apenas quem criou a mesa pode cancelar.' };
    pokerGames.delete(chatId);
    return { ok: true, message: 'Mesa de Poker cancelada. Valores já apostados não são devolvidos.' };
  }

  return { ok: false, message: 'Ação de Poker inválida. Use */poker* para ver os comandos.' };
}

// =========================
// Truco Paulista limpo
// =========================

function createTrucoPlayer(player) {
  return {
    id: player.id,
    whatsapp_id: player.whatsapp_id,
    phone: player.phone,
    hand: [],
    folded: false,
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

function formatTrucoTable(game) {
  return [
    '╭━━⪩ 🃏 *TRUCO PAULISTA LIMPO* ⪨━━',
    '▢',
    `▢ • Status: *${game.status === 'waiting' ? 'Aguardando jogadores' : 'Em andamento'}*`,
    `▢ • Jogadores: *${game.players.length}/4*`,
    `▢ • Valor da mão: *${game.handValue}*`,
    game.vira ? `▢ • Vira: *${cardText(game.vira)}*` : '▢ • Vira: ainda não saiu.',
    game.manilhaRank ? `▢ • Manilha: *${game.manilhaRank}*` : '▢ • Manilha: ainda não definida.',
    `▢ • Rodada: *${game.roundNumber || 0}/3*`,
    '▢',
    '▢ • Jogadores:',
    ...game.players.map((player, index) => `▢   ${index + 1}. @${player.phone}`),
    game.roundCards?.length ? '▢' : null,
    game.roundCards?.length ? `▢ • Cartas na mesa: ${game.roundCards.map((item) => `@${item.phone}: ${cardText(item.card)}`).join(' | ')}` : null,
    '╰━━─「🃏」─━━',
  ].filter(Boolean).join('\n');
}

function finishTrucoRound(chatId, game) {
  const sorted = [...game.roundCards].sort((a, b) => trucoCardPower(b.card, game.manilhaRank) - trucoCardPower(a.card, game.manilhaRank));
  const winner = sorted[0];
  game.roundWins[winner.playerId] = (game.roundWins[winner.playerId] || 0) + 1;

  const winningPlayer = game.players.find((player) => player.id === winner.playerId);
  const wonRounds = Number(game.roundWins[winner.playerId] || 0);
  const text = [
    '🏆 *Rodada do Truco encerrada!*',
    '',
    `Cartas: ${game.roundCards.map((item) => `@${item.phone} ${cardText(item.card)}`).join(' | ')}`,
    `Vencedor da rodada: @${winner.phone} com *${cardText(winner.card)}*`,
    `Placar da mão: ${game.players.map((player) => `@${player.phone} ${game.roundWins[player.id] || 0}`).join(' | ')}`,
  ];

  game.roundCards = [];
  game.roundNumber += 1;

  if (wonRounds >= 2 || game.roundNumber > 3) {
    trucoGames.delete(chatId);
    text.push('', `🎉 *Mão encerrada!* @${winningPlayer.phone} venceu valendo *${game.handValue}* ponto(s).`);
    return text.join('\n');
  }

  text.push('', 'Próxima rodada. Usem */truco jogar número* para jogar a próxima carta.');
  return text.join('\n');
}

async function sendTrucoHands(client, game) {
  const failed = [];
  for (const player of game.players) {
    const sent = await sendPrivate(client, player.whatsapp_id, [
      '🃏 *Suas cartas no Truco DragonVerse*',
      '',
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

async function truco(message, argsText = '', client) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const action = normalizeAction(firstToken(argsText));
  const rest = restAfterFirst(argsText);
  const chatId = message.from;
  let game = trucoGames.get(chatId);

  if (!action) {
    return {
      ok: true,
      message: [
        '╭━━⪩ 🃏 *TRUCO PAULISTA LIMPO* ⪨━━',
        '▢',
        '▢ • */truco criar* — Cria uma mesa.',
        '▢ • */truco entrar* — Entra na mesa.',
        '▢ • */truco iniciar* — Distribui cartas no privado.',
        '▢ • */truco jogar 1* — Joga uma carta da sua mão.',
        '▢ • */truco truco* — Aumenta para 3.',
        '▢ • */truco seis* — Aumenta para 6.',
        '▢ • */truco nove* — Aumenta para 9.',
        '▢ • */truco doze* — Aumenta para 12.',
        '▢ • */truco cartas* — Reenvia suas cartas no privado.',
        '▢',
        '▢ • Baralho limpo: sem 8, 9, 10 e coringas.',
        '╰━━─「🃏」─━━',
      ].join('\n'),
    };
  }

  if (['criar', 'nova'].includes(action)) {
    if (game) return { ok: false, message: 'Já existe uma mesa de Truco ativa neste grupo.' };
    game = {
      chatId,
      status: 'waiting',
      createdBy: player.id,
      players: [createTrucoPlayer(player)],
      deck: [],
      vira: null,
      manilhaRank: null,
      handValue: 1,
      roundNumber: 1,
      roundCards: [],
      roundWins: {},
    };
    trucoGames.set(chatId, game);
    return { ok: true, message: `🃏 *Mesa de Truco criada!*\n\nCriador: @${player.phone}\nUse */truco entrar* para participar.` };
  }

  if (!game) return { ok: false, message: 'Não existe mesa de Truco ativa. Use */truco criar*.' };

  if (['entrar', 'join'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa já começou.' };
    if (findTrucoPlayer(game, player.id)) return { ok: false, message: 'Você já está nessa mesa.' };
    if (game.players.length >= 4) return { ok: false, message: 'Mesa cheia. Máximo: 4 jogadores.' };

    game.players.push(createTrucoPlayer(player));
    return { ok: true, message: `✅ @${player.phone} entrou na mesa de Truco. Jogadores: *${game.players.length}/4*.` };
  }

  if (['iniciar', 'start'].includes(action)) {
    if (game.status !== 'waiting') return { ok: false, message: 'Essa mesa já foi iniciada.' };
    if (game.players.length < 2) return { ok: false, message: 'Truco precisa de pelo menos 2 jogadores.' };

    game.status = 'playing';
    game.deck = createDeck(TRUCO_DECK_RANKS);
    for (const trucoPlayer of game.players) {
      trucoPlayer.hand = draw(game.deck, 3);
    }
    game.vira = draw(game.deck, 1)[0];
    game.manilhaRank = nextTrucoRank(game.vira.rank);

    const failed = await sendTrucoHands(client, game);
    return {
      ok: true,
      message: [
        '🃏 *Truco iniciado!*',
        '',
        `Vira: *${cardText(game.vira)}*`,
        `Manilha: *${game.manilhaRank}*`,
        'As cartas foram enviadas no privado dos jogadores.',
        failed.length ? `⚠️ Não consegui enviar privado para: ${failed.map((phone) => `@${phone}`).join(', ')}` : null,
        '',
        formatTrucoTable(game),
      ].filter(Boolean).join('\n'),
    };
  }

  const trucoPlayer = findTrucoPlayer(game, player.id);
  if (!trucoPlayer) return { ok: false, message: 'Você não está nessa mesa de Truco.' };

  if (['status', 'mesa'].includes(action)) {
    return { ok: true, message: formatTrucoTable(game) };
  }

  if (['cartas', 'mao', 'mão'].includes(action)) {
    const sent = await sendPrivate(client, trucoPlayer.whatsapp_id, [
      '🃏 *Suas cartas no Truco DragonVerse*',
      '',
      `Vira: *${cardText(game.vira)}*`,
      `Manilha: *${game.manilhaRank}*`,
      '',
      formatTrucoHand(trucoPlayer),
    ].join('\n'));
    return { ok: sent, message: sent ? '✅ Enviei suas cartas no privado.' : 'Não consegui enviar suas cartas no privado.' };
  }

  if (game.status !== 'playing') return { ok: false, message: 'A mesa ainda não começou.' };

  if (['truco', 'seis', '6', 'nove', '9', 'doze', '12'].includes(action)) {
    let requested = nextTrucoRaise(game.handValue);
    if (['seis', '6'].includes(action)) requested = 6;
    if (['nove', '9'].includes(action)) requested = 9;
    if (['doze', '12'].includes(action)) requested = 12;

    if (requested <= game.handValue) return { ok: false, message: `A mão já está valendo *${game.handValue}*.` };
    if (requested > 12) return { ok: false, message: 'A mão já está no máximo: 12.' };

    game.handValue = requested;
    return { ok: true, message: `🔥 @${player.phone} aumentou a mão para *${game.handValue}*!` };
  }

  if (['jogar', 'usar'].includes(action)) {
    const selected = Number(firstToken(rest));
    if (!Number.isInteger(selected) || selected < 1 || selected > trucoPlayer.hand.length) {
      return { ok: false, message: 'Use assim: */truco jogar 1*' };
    }

    if (game.roundCards.some((item) => item.playerId === player.id)) {
      return { ok: false, message: 'Você já jogou uma carta nesta rodada.' };
    }

    const [card] = trucoPlayer.hand.splice(selected - 1, 1);
    game.roundCards.push({ playerId: player.id, phone: player.phone, card });

    if (game.roundCards.length >= game.players.length) {
      return { ok: true, message: finishTrucoRound(chatId, game) };
    }

    return {
      ok: true,
      message: [
        `🃏 @${player.phone} jogou *${cardText(card)}*.` ,
        '',
        `Cartas na mesa: ${game.roundCards.map((item) => `@${item.phone} ${cardText(item.card)}`).join(' | ')}`,
        `Faltam *${game.players.length - game.roundCards.length}* jogador(es).`,
      ].join('\n'),
    };
  }

  if (['cancelar'].includes(action)) {
    if (player.id !== game.createdBy) return { ok: false, message: 'Apenas quem criou a mesa pode cancelar.' };
    trucoGames.delete(chatId);
    return { ok: true, message: 'Mesa de Truco cancelada.' };
  }

  return { ok: false, message: 'Ação de Truco inválida. Use */truco* para ver os comandos.' };
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
  jogosStatus,
};
