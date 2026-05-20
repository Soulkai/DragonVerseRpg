const db = require('../database/db');
const { money, formatDateTime } = require('../utils/format');
const { normalizeText } = require('../utils/text');
const { mentionPlayer, mentionIds } = require('../utils/mentions');
const { getOrCreatePlayerFromMessage, getPlayerByWhatsAppId } = require('./playerService');

const DEFAULT_LIMIT = 20;

const DIRECTION_LABELS = {
  entrada: 'Entrada',
  saida: 'Saída',
  perda: 'Perda',
};

const DIRECTION_EMOJIS = {
  entrada: '📥',
  saida: '📤',
  perda: '📉',
};

const CATEGORY_LABELS = {
  pix_enviado: 'PIX enviado',
  pix_recebido: 'PIX recebido',
  addzenies: 'Zenies adicionados por ADM',
  retirarzenies: 'Zenies retirados por ADM',
  depositar: 'Depósito na poupança',
  retirar_poupanca: 'Retirada da poupança',
  compra_ki: 'Compra de Ki',
  compra_item: 'Compra na loja',
  caixa_compra: 'Abertura de caixa',
  caixa: 'Recompensa de caixa',
  tigrinho_aposta: 'Tigrinho',
  tigrinho: 'Tigrinho',
  emprestimo: 'Empréstimo recebido',
  emprestimo_pagamento: 'Pagamento de empréstimo',
  jogos_cartas_aposta: 'Aposta em jogo de cartas',
  jogos_cartas: 'Jogo de cartas',
  torneio_inscricao: 'Inscrição em torneio',
  torneio: 'Premiação de torneio',
  salario: 'Salário',
  juros_poupanca: 'Juros da poupança',
  manual_event: 'Evento manual',
  dragon_emoji: 'Emoji do dragão',
  auto_quiz: 'Pergunta automática',
  streak_3: 'Streak de 3 dias',
  streak_7: 'Streak de 7 dias',
  streak_15: 'Streak de 15 dias',
  convite_inicial: 'Bônus de convite',
  convite_recrutador: 'Bônus de recrutador',
  bonus_indicacao: 'Bônus de indicação',
  generic_code_zenies: 'Code de Zenies',
  bounty_target_win: 'Caça-cabeça — caça venceu',
  bounty_hunter_win: 'Caça-cabeça — caçador venceu',
  colecionavel_macaco: 'Colecionável Macaco',
  colecionavel_esfera: 'Colecionável Esfera do Dragão',
  colecionavel_tartaruga: 'Colecionável Tartaruga',
  troca_personagem: 'Troca de personagem',
};

function tableExists(tableName) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return Boolean(row);
}

function getCurrentBalance(playerId) {
  const row = db.prepare('SELECT zenies FROM players WHERE id = ?').get(playerId);
  return Number(row?.zenies || 0);
}

function recordLedger(entry = {}) {
  const playerId = Number(entry.playerId || entry.player_id || 0);
  const amount = Math.floor(Number(entry.amount || 0));
  if (!playerId || amount <= 0) return null;

  const direction = ['entrada', 'saida', 'perda'].includes(entry.direction) ? entry.direction : 'entrada';
  const category = String(entry.category || 'movimentacao');
  const description = String(entry.description || CATEGORY_LABELS[category] || category);
  const relatedPlayerId = entry.relatedPlayerId || entry.related_player_id || null;
  const metadata = entry.metadata ? JSON.stringify(entry.metadata) : null;
  const balanceAfter = Number.isFinite(Number(entry.balanceAfter)) ? Number(entry.balanceAfter) : getCurrentBalance(playerId);

  const result = db.prepare(`
    INSERT INTO economy_ledger (
      player_id,
      direction,
      category,
      amount,
      balance_after,
      related_player_id,
      description,
      metadata_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(playerId, direction, category, amount, balanceAfter, relatedPlayerId, description, metadata);

  return result.lastInsertRowid;
}

function normalizeFilter(argsText = '') {
  const text = normalizeText(String(argsText || '').trim());
  if (['entrada', 'entradas', 'ganho', 'ganhos', 'recebido', 'recebidos'].includes(text)) return 'entrada';
  if (['saida', 'saidas', 'saída', 'saídas', 'gasto', 'gastos', 'pix'].includes(text)) return 'saida';
  if (['perda', 'perdas', 'perdi', 'perdido', 'perdidos'].includes(text)) return 'perda';
  return 'todos';
}

function getPlayerName(player) {
  if (!player) return null;
  return mentionPlayer(player);
}

function ledgerRows(playerId, filter = 'todos') {
  const params = [playerId];
  let where = 'el.player_id = ?';
  if (filter !== 'todos') {
    where += ' AND el.direction = ?';
    params.push(filter);
  }

  return db.prepare(`
    SELECT
      el.*,
      rp.whatsapp_id AS related_whatsapp_id,
      rp.phone AS related_phone,
      rp.display_name AS related_display_name
    FROM economy_ledger el
    LEFT JOIN players rp ON rp.id = el.related_player_id
    WHERE ${where}
    ORDER BY datetime(el.created_at) DESC, el.id DESC
    LIMIT ${DEFAULT_LIMIT}
  `).all(...params);
}

function fallbackTransferRows(playerId, filter = 'todos') {
  if (!tableExists('transfer_history')) return [];
  if (filter === 'perda') return [];

  const rows = [];
  if (filter === 'todos' || filter === 'saida') {
    rows.push(...db.prepare(`
      SELECT
        th.id,
        th.amount,
        th.created_at,
        'saida' AS direction,
        'pix_enviado' AS category,
        'PIX enviado' AS description,
        p.id AS related_player_id,
        p.whatsapp_id AS related_whatsapp_id,
        p.phone AS related_phone,
        p.display_name AS related_display_name
      FROM transfer_history th
      LEFT JOIN players p ON p.id = th.to_player_id
      WHERE th.from_player_id = ?
    `).all(playerId));
  }

  if (filter === 'todos' || filter === 'entrada') {
    rows.push(...db.prepare(`
      SELECT
        th.id,
        th.amount,
        th.created_at,
        'entrada' AS direction,
        'pix_recebido' AS category,
        'PIX recebido' AS description,
        p.id AS related_player_id,
        p.whatsapp_id AS related_whatsapp_id,
        p.phone AS related_phone,
        p.display_name AS related_display_name
      FROM transfer_history th
      LEFT JOIN players p ON p.id = th.from_player_id
      WHERE th.to_player_id = ?
    `).all(playerId));
  }

  return rows.map((row) => ({ ...row, isFallback: true }));
}

function fallbackPurchaseRows(playerId, filter = 'todos') {
  if (!tableExists('purchase_history')) return [];
  if (!(filter === 'todos' || filter === 'saida')) return [];

  return db.prepare(`
    SELECT
      id,
      price AS amount,
      created_at,
      'saida' AS direction,
      'compra_item' AS category,
      'Compra na loja' AS description,
      target_name
    FROM purchase_history
    WHERE player_id = ?
  `).all(playerId).map((row) => ({ ...row, isFallback: true }));
}

function fallbackBoxRows(playerId, filter = 'todos') {
  if (!tableExists('box_openings')) return [];
  const rows = [];

  if (filter === 'todos' || filter === 'saida') {
    rows.push(...db.prepare(`
      SELECT
        id,
        price AS amount,
        created_at,
        'saida' AS direction,
        'caixa_compra' AS category,
        'Caixa aberta' AS description,
        box_id
      FROM box_openings
      WHERE player_id = ?
    `).all(playerId));
  }

  if (filter === 'todos' || filter === 'entrada') {
    rows.push(...db.prepare(`
      SELECT
        id,
        money_reward AS amount,
        created_at,
        'entrada' AS direction,
        'caixa' AS category,
        'Dinheiro encontrado em caixa' AS description,
        box_id
      FROM box_openings
      WHERE player_id = ? AND money_reward > 0
    `).all(playerId));
  }

  if (filter === 'perda') {
    rows.push(...db.prepare(`
      SELECT
        id,
        price AS amount,
        created_at,
        'perda' AS direction,
        'caixa_sem_retorno' AS category,
        'Caixa sem dinheiro' AS description,
        box_id
      FROM box_openings
      WHERE player_id = ? AND money_reward <= 0
    `).all(playerId));
  }

  return rows.map((row) => ({ ...row, isFallback: true }));
}

function buildHistory(playerId, filter) {
  const main = ledgerRows(playerId, filter);
  const fallback = [
    ...fallbackTransferRows(playerId, filter),
    ...fallbackPurchaseRows(playerId, filter),
    ...fallbackBoxRows(playerId, filter),
  ];

  const seen = new Set(main.map((row) => `${row.direction}:${row.category}:${row.amount}:${row.created_at}:${row.related_player_id || ''}`));
  const merged = [...main];
  for (const row of fallback) {
    const key = `${row.direction}:${row.category}:${row.amount}:${row.created_at}:${row.related_player_id || ''}`;
    if (!seen.has(key)) merged.push(row);
  }

  return merged
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, DEFAULT_LIMIT);
}

function formatLedgerRow(row, index) {
  const emoji = DIRECTION_EMOJIS[row.direction] || '•';
  const directionLabel = DIRECTION_LABELS[row.direction] || row.direction;
  const categoryLabel = CATEGORY_LABELS[row.category] || row.description || row.category;
  const date = formatDateTime(row.created_at);

  const related = row.related_whatsapp_id
    ? ` | ${row.direction === 'entrada' ? 'De' : 'Para'}: ${getPlayerName({ whatsapp_id: row.related_whatsapp_id, phone: row.related_phone, display_name: row.related_display_name })}`
    : '';

  const target = row.target_name ? ` | Item: ${row.target_name}` : '';
  const box = row.box_id ? ` | Caixa: ${row.box_id}` : '';
  const balance = Number.isFinite(Number(row.balance_after)) && !row.isFallback
    ? ` | Saldo após: ${money(row.balance_after)}`
    : '';

  return `${index + 1}. ${emoji} *${directionLabel}* — ${categoryLabel}\n   💸 ${money(row.amount)} Zenies | ${date}${related}${target}${box}${balance}`;
}

function extrato(message, argsText = '') {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const updated = getPlayerByWhatsAppId(player.whatsapp_id) || player;
  const filter = normalizeFilter(argsText);
  const rows = buildHistory(player.id, filter);

  const title = filter === 'todos'
    ? '📜 *Extrato DragonVerse*'
    : `📜 *Extrato DragonVerse — ${DIRECTION_LABELS[filter]}*`;

  const mentions = rows
    .map((row) => row.related_whatsapp_id)
    .filter(Boolean);

  return {
    ok: true,
    message: [
      title,
      '',
      `👤 Jogador: ${mentionPlayer(updated)}`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
      `🏦 Poupança: *${money(updated.deposito)} Zenies*`,
      '',
      rows.length
        ? rows.map(formatLedgerRow).join('\n\n')
        : 'Nenhuma movimentação encontrada nesse filtro.',
      '',
      'Filtros: */extrato entrada*, */extrato saida* ou */extrato perda*.',
    ].join('\n'),
    mentions: mentionIds(updated, ...mentions),
  };
}

module.exports = {
  DEFAULT_LIMIT,
  recordLedger,
  extrato,
};
