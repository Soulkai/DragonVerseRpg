const db = require('../database/db');
const settings = require('../config/settings');
const { isAdmin } = require('../utils/admin');
const { normalizeText } = require('../utils/text');
const { money } = require('../utils/format');
const {
  getOrCreatePlayerFromMessage,
  getOrCreatePlayerByWhatsAppId,
} = require('./playerService');
const {
  MANUAL_EVENT_REWARD,
  MANUAL_DAILY_LIMIT,
  MANUAL_DAILY_REWARD_LIMIT,
  DRAGON_EMOJI_REWARD,
  DRAGON_EMOJI_DAILY_LIMIT_PER_CHAT,
  AUTO_QUIZ_REWARD,
  AUTO_QUIZ_DAILY_LIMIT_PER_CHAT,
  DRAGON_EMOJI_INTERVAL_MINUTES,
  ACTIVE_EVENT_EXPIRATION_MINUTES,
  AUTO_QUIZ_HOURS,
  quizQuestions,
  hangmanWords,
  quickChallenges,
  randomFrom,
} = require('../data/events');

const MANUAL_TYPES = ['manual_quiz', 'hangman', 'quick_challenge'];

function nowIso() {
  return new Date().toISOString();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function getDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: settings.timezone || 'America/Campo_Grande',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function dateKey() {
  return getDateParts().dateKey;
}

function cleanAnswer(input = '') {
  const text = normalizeText(input).toUpperCase();
  const match = text.match(/[ABCD]/);
  return match ? match[0] : '';
}

function normalizeWord(input = '') {
  return normalizeText(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseState(event) {
  try {
    return event?.state_json ? JSON.parse(event.state_json) : {};
  } catch {
    return {};
  }
}

function stringifyState(state) {
  return JSON.stringify(state || {});
}

function cleanupExpiredEvents() {
  db.prepare(`
    UPDATE active_events
    SET status = 'expired',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND datetime(expires_at) <= datetime('now')
  `).run();
}

function ensurePlayerDailyStats(playerId) {
  const key = dateKey();
  db.prepare(`
    INSERT INTO event_daily_stats (player_id, date_key)
    VALUES (?, ?)
    ON CONFLICT(player_id, date_key) DO NOTHING
  `).run(playerId, key);

  return db.prepare(`
    SELECT * FROM event_daily_stats
    WHERE player_id = ? AND date_key = ?
  `).get(playerId, key);
}

function ensureChatDailyStats(chatId) {
  const key = dateKey();
  db.prepare(`
    INSERT INTO event_chat_daily_stats (chat_id, date_key)
    VALUES (?, ?)
    ON CONFLICT(chat_id, date_key) DO NOTHING
  `).run(chatId, key);

  return db.prepare(`
    SELECT * FROM event_chat_daily_stats
    WHERE chat_id = ? AND date_key = ?
  `).get(chatId, key);
}

function getActiveManualEvent(playerId) {
  return db.prepare(`
    SELECT * FROM active_events
    WHERE player_id = ?
      AND status = 'active'
      AND event_type IN (${MANUAL_TYPES.map(() => '?').join(',')})
    ORDER BY created_at DESC
    LIMIT 1
  `).get(playerId, ...MANUAL_TYPES);
}

function getActiveChatEvent(chatId, type) {
  return db.prepare(`
    SELECT * FROM active_events
    WHERE chat_id = ?
      AND event_type = ?
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(chatId, type);
}

function canUseManualEvent(player) {
  const stats = ensurePlayerDailyStats(player.id);
  if (Number(stats.manual_participations || 0) >= MANUAL_DAILY_LIMIT) {
    return {
      ok: false,
      message: [
        '⛔ *Limite diário de eventos atingido.*',
        '',
        `Você já participou de *${MANUAL_DAILY_LIMIT}/${MANUAL_DAILY_LIMIT}* eventos hoje.`,
        `Máximo possível por dia: *${money(MANUAL_DAILY_REWARD_LIMIT)} Zenies*.`,
      ].join('\n'),
    };
  }

  return { ok: true, stats };
}

function consumeManualParticipation(playerId) {
  const key = dateKey();
  db.prepare(`
    UPDATE event_daily_stats
    SET manual_participations = manual_participations + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ? AND date_key = ?
  `).run(playerId, key);
}

function addZeniesToPlayer(playerId, amount) {
  db.prepare(`
    UPDATE players
    SET zenies = zenies + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, playerId);
}

function rewardManualEvent(playerId) {
  const key = dateKey();
  const stats = ensurePlayerDailyStats(playerId);
  const remaining = MANUAL_DAILY_REWARD_LIMIT - Number(stats.manual_reward_total || 0);
  const reward = Math.max(0, Math.min(MANUAL_EVENT_REWARD, remaining));

  if (reward > 0) addZeniesToPlayer(playerId, reward);

  db.prepare(`
    UPDATE event_daily_stats
    SET manual_wins = manual_wins + 1,
        manual_reward_total = manual_reward_total + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ? AND date_key = ?
  `).run(reward, playerId, key);

  return reward;
}

function rewardEmojiEvent(playerId) {
  const key = dateKey();
  addZeniesToPlayer(playerId, DRAGON_EMOJI_REWARD);
  db.prepare(`
    UPDATE event_daily_stats
    SET emoji_claims = emoji_claims + 1,
        emoji_reward_total = emoji_reward_total + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ? AND date_key = ?
  `).run(DRAGON_EMOJI_REWARD, playerId, key);
}

function rewardAutoQuiz(playerId) {
  const key = dateKey();
  addZeniesToPlayer(playerId, AUTO_QUIZ_REWARD);
  db.prepare(`
    UPDATE event_daily_stats
    SET auto_quiz_wins = auto_quiz_wins + 1,
        auto_quiz_reward_total = auto_quiz_reward_total + ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ? AND date_key = ?
  `).run(AUTO_QUIZ_REWARD, playerId, key);
}

function createActiveEvent({ chatId, playerId = null, type, answer = null, reward, state, expiresInMinutes = ACTIVE_EVENT_EXPIRATION_MINUTES }) {
  const createdAt = new Date();
  const result = db.prepare(`
    INSERT INTO active_events (
      chat_id,
      player_id,
      event_type,
      state_json,
      answer,
      reward,
      status,
      created_at,
      expires_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP)
  `).run(
    chatId,
    playerId,
    type,
    stringifyState(state),
    answer,
    reward,
    createdAt.toISOString(),
    addMinutes(createdAt, expiresInMinutes)
  );

  return result.lastInsertRowid;
}

function finishEvent(eventId, status = 'finished', claimedByPlayerId = null) {
  db.prepare(`
    UPDATE active_events
    SET status = ?,
        claimed_by_player_id = COALESCE(?, claimed_by_player_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'active'
  `).run(status, claimedByPlayerId, eventId);
}

function updateEventState(eventId, state) {
  db.prepare(`
    UPDATE active_events
    SET state_json = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(stringifyState(state), eventId);
}

function formatQuestion(question, title = 'Evento de Perguntas') {
  return [
    `🐉 *${title}*`,
    '',
    question.question || question.text,
    '',
    `A) ${question.options.A}`,
    `B) ${question.options.B}`,
    `C) ${question.options.C}`,
    `D) ${question.options.D}`,
    '',
    'Responda com: */responder A*',
  ].join('\n');
}

function revealHangman(state) {
  const guessed = new Set(state.guessed || []);
  return String(state.word || '')
    .split('')
    .map((char) => {
      if (char === ' ') return ' / ';
      return guessed.has(normalizeWord(char)) ? char : '_';
    })
    .join(' ');
}

function formatHangman(state) {
  return [
    '🪢 *Evento: Forca Dragon Ball*',
    '',
    `Dica: ${state.hint}`,
    `Palavra: ${revealHangman(state)}`,
    `Letras usadas: ${(state.guessed || []).join(', ') || 'Nenhuma'}`,
    `Erros: ${state.wrong || 0}/${state.maxWrong || 6}`,
    '',
    'Use: */letra A*',
    'Ou tente finalizar: */chutar palavra*',
  ].join('\n');
}

function eventList(message) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const stats = ensurePlayerDailyStats(player.id);

  return {
    ok: true,
    message: [
      '┏━━━━━━━━━━━━━┓',
      '          Eventos',
      '┗━━━━━━━━━━━━━┛',
      '',
      '🎯 *Eventos manuais*',
      `Cada player pode participar de até *${MANUAL_DAILY_LIMIT} por dia*.`,
      `Cada acerto vale *${money(MANUAL_EVENT_REWARD)} Zenies*.`,
      `Máximo diário em eventos manuais: *${money(MANUAL_DAILY_REWARD_LIMIT)} Zenies*.`,
      'Se errar, não ganha nada.',
      '',
      '*Comandos:*',
      '*/eventos pergunta* — Sorteia uma pergunta de Dragon Ball.',
      '*/eventos forca* — Começa uma forca de Dragon Ball.',
      '*/eventos desafio* — Sorteia um desafio rápido do RPG.',
      '*/responder A* — Responde pergunta/desafio.',
      '*/letra A* — Tenta uma letra na forca.',
      '*/chutar Kamehameha* — Tenta finalizar a forca.',
      '',
      '🐲 *Eventos automáticos do grupo*',
      `Emoji do dragão: a cada hora, até *${DRAGON_EMOJI_DAILY_LIMIT_PER_CHAT} por dia*. Primeiro */pegar* ganha *${money(DRAGON_EMOJI_REWARD)} Zenies*.`,
      `Pergunta relâmpago: *${AUTO_QUIZ_DAILY_LIMIT_PER_CHAT} vezes por dia*. Primeiro acerto ganha *${money(AUTO_QUIZ_REWARD)} Zenies*.`,
      '',
      '⚙️ *Admin:*',
      '*/eventos ativar* — Ativa eventos automáticos neste chat.',
      '*/eventos desativar* — Desativa eventos automáticos neste chat.',
      '',
      '📊 *Seu status hoje:*',
      `Participações: *${stats.manual_participations}/${MANUAL_DAILY_LIMIT}*`,
      `Vitórias manuais: *${stats.manual_wins}*`,
      `Zenies ganhos em eventos manuais: *${money(stats.manual_reward_total)}*`,
    ].join('\n'),
  };
}

function hasEventChatPermission(message) {
  if (isAdmin(message)) return true;
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  return ['A.S', 'S.M'].includes(String(player.cargo_id || '').toUpperCase());
}

function enableEventChat(message) {
  if (!hasEventChatPermission(message)) {
    return { ok: false, message: 'Apenas admins, Autoridade Suprema ou Supremo Ministro podem ativar eventos automáticos.' };
  }

  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  db.prepare(`
    INSERT INTO event_chats (chat_id, is_enabled, enabled_by, created_at, updated_at)
    VALUES (?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(chat_id) DO UPDATE SET
      is_enabled = 1,
      enabled_by = excluded.enabled_by,
      updated_at = CURRENT_TIMESTAMP
  `).run(message.from, player.whatsapp_id);

  return { ok: true, message: '✅ Eventos automáticos ativados neste chat.' };
}

function disableEventChat(message) {
  if (!hasEventChatPermission(message)) {
    return { ok: false, message: 'Apenas admins, Autoridade Suprema ou Supremo Ministro podem desativar eventos automáticos.' };
  }

  db.prepare(`
    UPDATE event_chats
    SET is_enabled = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE chat_id = ?
  `).run(message.from);

  return { ok: true, message: '✅ Eventos automáticos desativados neste chat.' };
}

function startQuestionEvent(message) {
  cleanupExpiredEvents();
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const active = getActiveManualEvent(player.id);
  if (active) {
    return { ok: false, message: 'Você já tem um evento ativo. Termine ele antes de começar outro.' };
  }

  const limit = canUseManualEvent(player);
  if (!limit.ok) return limit;

  const question = randomFrom(quizQuestions);
  const transaction = db.transaction(() => {
    consumeManualParticipation(player.id);
    createActiveEvent({
      chatId: message.from,
      playerId: player.id,
      type: 'manual_quiz',
      answer: question.answer,
      reward: MANUAL_EVENT_REWARD,
      state: { question },
    });
  });

  transaction();
  return { ok: true, message: formatQuestion(question, 'Evento: Perguntas e Respostas') };
}

function startQuickChallenge(message) {
  cleanupExpiredEvents();
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const active = getActiveManualEvent(player.id);
  if (active) {
    return { ok: false, message: 'Você já tem um evento ativo. Termine ele antes de começar outro.' };
  }

  const limit = canUseManualEvent(player);
  if (!limit.ok) return limit;

  const challenge = randomFrom(quickChallenges);
  const transaction = db.transaction(() => {
    consumeManualParticipation(player.id);
    createActiveEvent({
      chatId: message.from,
      playerId: player.id,
      type: 'quick_challenge',
      answer: challenge.answer,
      reward: MANUAL_EVENT_REWARD,
      state: { question: { question: `*${challenge.title}*\n\n${challenge.text}`, options: challenge.options } },
    });
  });

  transaction();
  return { ok: true, message: formatQuestion({ question: `*${challenge.title}*\n\n${challenge.text}`, options: challenge.options }, 'Evento: Desafio Rápido') };
}

function startHangmanEvent(message) {
  cleanupExpiredEvents();
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const active = getActiveManualEvent(player.id);
  if (active) {
    return { ok: false, message: 'Você já tem um evento ativo. Termine ele antes de começar outro.' };
  }

  const limit = canUseManualEvent(player);
  if (!limit.ok) return limit;

  const selected = randomFrom(hangmanWords);
  const state = {
    word: selected.word.toUpperCase(),
    normalizedWord: normalizeWord(selected.word),
    hint: selected.hint,
    guessed: [],
    wrong: 0,
    maxWrong: 6,
  };

  const transaction = db.transaction(() => {
    consumeManualParticipation(player.id);
    createActiveEvent({
      chatId: message.from,
      playerId: player.id,
      type: 'hangman',
      answer: state.normalizedWord,
      reward: MANUAL_EVENT_REWARD,
      state,
      expiresInMinutes: 60,
    });
  });

  transaction();
  return { ok: true, message: formatHangman(state) };
}

function eventos(message, argsText = '') {
  const action = normalizeText(argsText);

  if (!action) return eventList(message);
  if (['ativar', 'on', 'ligar'].includes(action)) return enableEventChat(message);
  if (['desativar', 'off', 'desligar'].includes(action)) return disableEventChat(message);
  if (['pergunta', 'perguntas', 'quiz'].includes(action)) return startQuestionEvent(message);
  if (['forca', 'hangman'].includes(action)) return startHangmanEvent(message);
  if (['desafio', 'treino', 'rapido', 'rápido'].includes(action)) return startQuickChallenge(message);
  if (['status', 'meustatus', 'meu status'].includes(action)) return eventList(message);

  return {
    ok: false,
    message: 'Evento não encontrado. Use */eventos* para ver a lista ou */eventos pergunta*, */eventos forca*, */eventos desafio*.',
  };
}

function answerManualEvent(message, answerRaw) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const active = getActiveManualEvent(player.id);
  if (!active || !['manual_quiz', 'quick_challenge'].includes(active.event_type)) return null;

  const answer = cleanAnswer(answerRaw);
  if (!answer) {
    return { ok: false, message: 'Responda com A, B, C ou D. Exemplo: */responder A*' };
  }

  if (answer !== String(active.answer || '').toUpperCase()) {
    finishEvent(active.id, 'failed');
    return {
      ok: true,
      message: [
        '❌ *Resposta errada.*',
        '',
        'Você não ganhou Zenies nesse evento.',
        `Resposta correta: *${String(active.answer || '').toUpperCase()}*`,
      ].join('\n'),
    };
  }

  const reward = rewardManualEvent(player.id);
  finishEvent(active.id, 'finished', player.id);

  return {
    ok: true,
    message: [
      '✅ *Resposta correta!*',
      '',
      `Você ganhou *${money(reward)} Zenies*.`,
    ].join('\n'),
  };
}

function answerAutoQuiz(message, answerRaw) {
  const active = getActiveChatEvent(message.from, 'auto_quiz');
  if (!active) return null;

  const answer = cleanAnswer(answerRaw);
  if (!answer) return null;

  if (answer !== String(active.answer || '').toUpperCase()) {
    return {
      ok: false,
      message: '❌ Resposta errada para a pergunta relâmpago. Ela continua aberta até alguém acertar.',
    };
  }

  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  ensurePlayerDailyStats(player.id);
  rewardAutoQuiz(player.id);
  finishEvent(active.id, 'finished', player.id);

  return {
    ok: true,
    message: [
      '⚡ *Pergunta relâmpago respondida!*',
      '',
      `@${player.phone} acertou primeiro e ganhou *${money(AUTO_QUIZ_REWARD)} Zenies*!`,
    ].join('\n'),
  };
}

function responder(message, argsText = '') {
  cleanupExpiredEvents();

  const manual = answerManualEvent(message, argsText);
  if (manual) return manual;

  const auto = answerAutoQuiz(message, argsText);
  if (auto) return auto;

  return {
    ok: false,
    message: 'Não existe pergunta ativa para você ou pergunta relâmpago ativa neste chat.',
  };
}

function guessLetter(message, argsText = '') {
  cleanupExpiredEvents();
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const active = getActiveManualEvent(player.id);

  if (!active || active.event_type !== 'hangman') {
    return { ok: false, message: 'Você não tem uma forca ativa. Use */eventos forca* para começar.' };
  }

  const letter = normalizeWord(argsText).slice(0, 1);
  if (!letter) return { ok: false, message: 'Use assim: */letra A*' };

  const state = parseState(active);
  state.guessed = state.guessed || [];
  state.wrong = Number(state.wrong || 0);
  state.maxWrong = Number(state.maxWrong || 6);

  if (state.guessed.includes(letter)) {
    return { ok: false, message: 'Essa letra já foi usada.\n\n' + formatHangman(state) };
  }

  state.guessed.push(letter);
  const correct = state.normalizedWord.includes(letter);
  if (!correct) state.wrong += 1;

  const discovered = state.normalizedWord.split('').every((char) => state.guessed.includes(char));

  if (discovered) {
    const reward = rewardManualEvent(player.id);
    finishEvent(active.id, 'finished', player.id);
    return {
      ok: true,
      message: [
        '✅ *Forca concluída!*',
        '',
        `Palavra: *${state.word}*`,
        `Você ganhou *${money(reward)} Zenies*.`,
      ].join('\n'),
    };
  }

  if (state.wrong >= state.maxWrong) {
    finishEvent(active.id, 'failed');
    return {
      ok: true,
      message: [
        '💀 *Você perdeu a forca.*',
        '',
        `A palavra era: *${state.word}*`,
        'Você não ganhou Zenies nesse evento.',
      ].join('\n'),
    };
  }

  updateEventState(active.id, state);
  return {
    ok: true,
    message: `${correct ? '✅ Letra correta!' : '❌ Letra errada!'}\n\n${formatHangman(state)}`,
  };
}

function guessWord(message, argsText = '') {
  cleanupExpiredEvents();
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const active = getActiveManualEvent(player.id);

  if (!active || active.event_type !== 'hangman') {
    return { ok: false, message: 'Você não tem uma forca ativa. Use */eventos forca* para começar.' };
  }

  const guess = normalizeWord(argsText);
  if (!guess) return { ok: false, message: 'Use assim: */chutar Kamehameha*' };

  const state = parseState(active);
  if (guess !== state.normalizedWord) {
    finishEvent(active.id, 'failed');
    return {
      ok: true,
      message: [
        '❌ *Chute errado.*',
        '',
        `A palavra era: *${state.word}*`,
        'Você não ganhou Zenies nesse evento.',
      ].join('\n'),
    };
  }

  const reward = rewardManualEvent(player.id);
  finishEvent(active.id, 'finished', player.id);
  return {
    ok: true,
    message: [
      '✅ *Chute correto!*',
      '',
      `Palavra: *${state.word}*`,
      `Você ganhou *${money(reward)} Zenies*.`,
    ].join('\n'),
  };
}

function pegar(message) {
  cleanupExpiredEvents();
  const active = getActiveChatEvent(message.from, 'dragon_emoji');
  if (!active) {
    return { ok: false, message: 'Não há nenhum emoji de dragão ativo neste chat agora.' };
  }

  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  ensurePlayerDailyStats(player.id);
  rewardEmojiEvent(player.id);
  finishEvent(active.id, 'finished', player.id);

  return {
    ok: true,
    message: [
      '🐉 *Dragão capturado!*',
      '',
      `@${player.phone} pegou primeiro e ganhou *${money(DRAGON_EMOJI_REWARD)} Zenies*!`,
    ].join('\n'),
  };
}

function shouldSendEmoji(chat) {
  const stats = ensureChatDailyStats(chat.chat_id);
  if (Number(stats.emoji_sent || 0) >= DRAGON_EMOJI_DAILY_LIMIT_PER_CHAT) return false;
  if (getActiveChatEvent(chat.chat_id, 'dragon_emoji')) return false;

  if (!chat.last_emoji_at) return true;
  const last = new Date(chat.last_emoji_at).getTime();
  if (!Number.isFinite(last)) return true;

  return Date.now() - last >= DRAGON_EMOJI_INTERVAL_MINUTES * 60 * 1000;
}

function shouldSendAutoQuiz(chat) {
  const stats = ensureChatDailyStats(chat.chat_id);
  if (Number(stats.auto_quiz_sent || 0) >= AUTO_QUIZ_DAILY_LIMIT_PER_CHAT) return false;
  if (getActiveChatEvent(chat.chat_id, 'auto_quiz')) return false;

  const { hour } = getDateParts();
  if (!AUTO_QUIZ_HOURS.includes(hour)) return false;

  if (!chat.last_auto_quiz_at) return true;
  const last = new Date(chat.last_auto_quiz_at).getTime();
  if (!Number.isFinite(last)) return true;

  return Date.now() - last >= 4 * 60 * 60 * 1000;
}

function markEmojiSent(chatId) {
  const key = dateKey();
  db.prepare(`
    UPDATE event_chat_daily_stats
    SET emoji_sent = emoji_sent + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE chat_id = ? AND date_key = ?
  `).run(chatId, key);

  db.prepare(`
    UPDATE event_chats
    SET last_emoji_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE chat_id = ?
  `).run(nowIso(), chatId);
}

function markAutoQuizSent(chatId) {
  const key = dateKey();
  db.prepare(`
    UPDATE event_chat_daily_stats
    SET auto_quiz_sent = auto_quiz_sent + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE chat_id = ? AND date_key = ?
  `).run(chatId, key);

  db.prepare(`
    UPDATE event_chats
    SET last_auto_quiz_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE chat_id = ?
  `).run(nowIso(), chatId);
}

async function sendDragonEmojiEvent(client, chatId) {
  createActiveEvent({
    chatId,
    type: 'dragon_emoji',
    reward: DRAGON_EMOJI_REWARD,
    state: { emoji: '🐉' },
    expiresInMinutes: 55,
  });
  markEmojiSent(chatId);

  await client.sendMessage(chatId, [
    '🐉 *Evento: Pegue o Emoji!*',
    '',
    'Um dragão apareceu no chat: 🐉',
    '',
    `O primeiro player que mandar */pegar* ganha *${money(DRAGON_EMOJI_REWARD)} Zenies*.`,
  ].join('\n'));
}

async function sendAutoQuizEvent(client, chatId) {
  const question = randomFrom(quizQuestions);
  createActiveEvent({
    chatId,
    type: 'auto_quiz',
    answer: question.answer,
    reward: AUTO_QUIZ_REWARD,
    state: { question },
    expiresInMinutes: 50,
  });
  markAutoQuizSent(chatId);

  await client.sendMessage(chatId, [
    formatQuestion(question, 'Pergunta Relâmpago'),
    '',
    `⚡ O primeiro que acertar ganha *${money(AUTO_QUIZ_REWARD)} Zenies*!`,
  ].join('\n'));
}

async function runAutoEvents(client) {
  cleanupExpiredEvents();
  const chats = db.prepare(`
    SELECT * FROM event_chats
    WHERE is_enabled = 1
  `).all();

  for (const chat of chats) {
    try {
      ensureChatDailyStats(chat.chat_id);

      if (shouldSendEmoji(chat)) {
        await sendDragonEmojiEvent(client, chat.chat_id);
      }

      const refreshed = db.prepare('SELECT * FROM event_chats WHERE chat_id = ?').get(chat.chat_id) || chat;
      if (shouldSendAutoQuiz(refreshed)) {
        await sendAutoQuizEvent(client, chat.chat_id);
      }
    } catch (error) {
      console.error(`[eventos] Erro ao enviar evento automático para ${chat.chat_id}:`, error.message);
    }
  }
}

module.exports = {
  eventos,
  responder,
  guessLetter,
  guessWord,
  pegar,
  runAutoEvents,
  cleanupExpiredEvents,
};
