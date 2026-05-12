const db = require('../database/db');
const settings = require('../config/settings');
const { parseAmount } = require('../utils/numbers');
const { money } = require('../utils/format');
const { getOrCreatePlayerFromMessage, getPlayerByWhatsAppId } = require('./playerService');
const { grantZenies } = require('./rewardService');
const { recordLedger } = require('./ledgerService');

const BOX_DAILY_LIMIT = 10;
const BOX_COLLECTIBLE_CHANCE = 0.65;
const NINE_COLLECTIBLE_OVERALL_CHANCE_PERCENT = 0.0001;

const BOXES = [
  { id: '10kk', label: 'Caixa 10kk', price: 10_000_000 },
  { id: '100kk', label: 'Caixa 100kk', price: 100_000_000 },
  { id: '350kk', label: 'Caixa 350kk', price: 350_000_000 },
  { id: '1b', label: 'Caixa 1B', price: 1_000_000_000 },
];

const COLLECTIBLES = [
  { id: 'macaco', name: 'Macaco', emoji: '🐒', weight: 16, completeText: '+10B Zenies', reward: (playerId) => grantZenies(playerId, 10_000_000_000, 'colecionavel_macaco') },
  { id: 'dragao', name: 'Dragão', emoji: '🐉', weight: 10, completeText: '50% de desconto em 5 compras', reward: (playerId) => addDiscount(playerId, 50, 5) },
  { id: 'esfera', name: 'Esfera do Dragão', emoji: '🔮', weight: 14, completeText: '+3B Zenies', reward: (playerId) => grantZenies(playerId, 3_000_000_000, 'colecionavel_esfera') },
  { id: 'capsula', name: 'Cápsula', emoji: '💊', weight: 16, completeText: '30% de desconto em 3 compras', reward: (playerId) => addDiscount(playerId, 30, 3) },
  { id: 'aura', name: 'Aura Divina', emoji: '✨', weight: 8, completeText: '+1 Ki, até Ki 10', reward: (playerId) => addKi(playerId, 1, 10) },
  { id: 'tartaruga', name: 'Tartaruga', emoji: '🐢', weight: 18, completeText: '+1B Zenies', reward: (playerId) => grantZenies(playerId, 1_000_000_000, 'colecionavel_tartaruga') },
];

function addDiscount(playerId, percent, uses) {
  db.prepare(`
    INSERT INTO player_discounts (player_id, percent, uses)
    VALUES (?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      percent = MAX(percent, excluded.percent),
      uses = uses + excluded.uses,
      updated_at = CURRENT_TIMESTAMP
  `).run(playerId, percent, uses);
}

function addKi(playerId, amount, maxKi = 10) {
  db.prepare(`
    UPDATE players
    SET ki_atual = MIN(ki_atual + ?, ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, maxKi, playerId);
}

function getPlayerCollectibleQuantities(playerId) {
  const rows = db.prepare(`
    SELECT collectible_id, quantity
    FROM player_collectibles
    WHERE player_id = ?
  `).all(playerId);

  return rows.reduce((acc, row) => {
    acc[row.collectible_id] = Number(row.quantity || 0);
    return acc;
  }, {});
}

function weightedCollectible(playerId) {
  const quantities = getPlayerCollectibleQuantities(playerId);
  const protectedCollectibles = COLLECTIBLES.filter((item) => Number(quantities[item.id] || 0) >= 9);
  const normalCollectibles = COLLECTIBLES.filter((item) => Number(quantities[item.id] || 0) < 9);

  // Quando um colecionável está em 9/10, ele fica quase impossível:
  // 0,0001% de chance por abertura de caixa.
  // Como o sorteio de colecionável acontece em 65% das caixas, convertemos
  // essa chance total para uma chance condicional dentro do sorteio de colecionável.
  const protectedConditionalPercent = NINE_COLLECTIBLE_OVERALL_CHANCE_PERCENT / BOX_COLLECTIBLE_CHANCE;
  let roll = Math.random() * 100;

  for (const item of protectedCollectibles) {
    roll -= protectedConditionalPercent;
    if (roll <= 0) return item;
  }

  if (normalCollectibles.length === 0) {
    return null;
  }

  const reservedPercent = protectedCollectibles.length * protectedConditionalPercent;
  const normalPercentPool = Math.max(0, 100 - reservedPercent);
  const normalTotalWeight = normalCollectibles.reduce((sum, item) => sum + item.weight, 0);

  let weightedRoll = Math.random() * normalTotalWeight;
  for (const item of normalCollectibles) {
    weightedRoll -= item.weight;
    if (weightedRoll <= 0) return item;
  }

  return normalCollectibles[0];
}

function findBox(input = '') {
  const text = String(input || '').toLowerCase().replace(/\s+/g, '');
  const amount = parseAmount(input);
  if (amount) return BOXES.find((box) => box.price === amount) || null;
  return BOXES.find((box) => [box.id, box.label.toLowerCase().replace(/\s+/g, '')].includes(text));
}

function localDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone || 'America/Campo_Grande',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function rollBoxMultiplier() {
  const roll = Math.random() * 100;

  if (roll < 18) {
    return { multiplier: 0, tier: '18% — 0x, não veio dinheiro' };
  }

  if (roll < 50) {
    return { multiplier: randomInRange(0.001, 0.05), tier: '32% — 0,001x até 0,05x' };
  }

  if (roll < 75) {
    return { multiplier: randomInRange(0.05, 0.9), tier: '25% — 0,05x até 0,9x' };
  }

  if (roll < 90) {
    return { multiplier: randomInRange(1, 1.5), tier: '15% — 1x até 1,5x' };
  }

  if (roll < 97) {
    return { multiplier: randomInRange(2, 2.5), tier: '7% — 2x até 2,5x' };
  }

  if (roll < 99.5) {
    return { multiplier: randomInRange(2.5, 3), tier: '2,5% — 2,5x até 3x' };
  }

  return { multiplier: randomInRange(3, 4), tier: '0,5% — 3x até 4x' };
}

function formatMultiplier(multiplier) {
  if (!multiplier) return '0x';
  return `${multiplier.toFixed(3).replace('.', ',').replace(/0+$/, '').replace(/,$/, '')}x`;
}

function randomMoney(price) {
  const result = rollBoxMultiplier();
  return {
    ...result,
    amount: Math.floor(price * result.multiplier),
  };
}

function getTodayBoxCount(playerId) {
  const today = localDateKey();
  const row = db.prepare(`
    SELECT COUNT(*) AS total
    FROM box_openings
    WHERE player_id = ? AND date_key = ?
  `).get(playerId, today);

  return Number(row?.total || 0);
}

function listBoxes(message) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const collectibles = db.prepare(`
    SELECT * FROM player_collectibles
    WHERE player_id = ? AND quantity > 0
    ORDER BY collectible_name COLLATE NOCASE ASC
  `).all(player.id);

  return {
    ok: true,
    message: [
      '╭━━⪩ 🎁 *CAIXAS DRAGONVERSE* ⪨━━',
      '▢',
      ...BOXES.map((box) => `▢ • */caixa abrir ${box.id}* — ${money(box.price)} Zenies`),
      '▢',
      '▢ • Cada player pode abrir até *10 caixas por dia*.',
      '▢ • O dinheiro da caixa usa chance ponderada:',
      '▢   ⤷ 18%  → 0x, não vem dinheiro.',
      '▢   ⤷ 32%  → 0,001x até 0,05x.',
      '▢   ⤷ 25%  → 0,05x até 0,9x.',
      '▢   ⤷ 15%  → 1x até 1,5x.',
      '▢   ⤷ 7%   → 2x até 2,5x.',
      '▢   ⤷ 2,5% → 2,5x até 3x.',
      '▢   ⤷ 0,5% → 3x até 4x.',
      '▢ • Também pode vir colecionável. Ao juntar 10, o prêmio é ativado automaticamente.',
      '▢ • Quando um colecionável estiver em *9/10*, ele passa a ter apenas *0,0001%* de chance por caixa.',
      '▢',
      '╰━━─「🎁」─━━',
      '',
      '🏺 *Colecionáveis possíveis:*',
      ...COLLECTIBLES.map((item) => `${item.emoji} ${item.name} — 10x: ${item.completeText}`),
      collectibles.length ? '\n📦 *Seus colecionáveis:*' : '',
      ...collectibles.map((item) => `• ${item.collectible_name}: ${item.quantity}/10`),
    ].filter(Boolean).join('\n'),
  };
}

function openBox(message, argsText = '') {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const raw = String(argsText || '').replace(/^abrir\s+/i, '').trim();
  const box = findBox(raw);
  if (!box) return listBoxes(message);

  const openedToday = getTodayBoxCount(player.id);
  if (openedToday >= BOX_DAILY_LIMIT) {
    return {
      ok: false,
      message: [
        '🎁 *Limite diário de caixas atingido!*',
        '',
        `Você já abriu *${BOX_DAILY_LIMIT}/${BOX_DAILY_LIMIT}* caixas hoje.`,
        'Volte amanhã para abrir mais caixas.',
      ].join('\n'),
    };
  }

  if (Number(player.zenies || 0) < box.price) {
    return { ok: false, message: `Saldo insuficiente. Essa caixa custa *${money(box.price)} Zenies* e você tem *${money(player.zenies)}*.` };
  }

  const rewardRoll = randomMoney(box.price);
  const moneyReward = rewardRoll.amount;
  const collectible = Math.random() < BOX_COLLECTIBLE_CHANCE ? weightedCollectible(player.id) : null;
  let completionText = null;

  db.transaction(() => {
    db.prepare(`
      UPDATE players
      SET zenies = zenies - ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(box.price, player.id);

    recordLedger({
      playerId: player.id,
      direction: 'saida',
      category: 'caixa_compra',
      amount: box.price,
      description: `Abertura de ${box.label}`,
      metadata: { boxId: box.id, multiplier: rewardRoll.multiplier },
    });

    grantZenies(player.id, moneyReward, 'caixa');

    db.prepare(`
      INSERT INTO box_openings (player_id, box_id, price, money_reward, collectible_id, collectible_name, date_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(player.id, box.id, box.price, moneyReward, collectible?.id || null, collectible?.name || null, localDateKey());

    if (collectible) {
      db.prepare(`
        INSERT INTO player_collectibles (player_id, collectible_id, collectible_name, quantity)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(player_id, collectible_id) DO UPDATE SET
          quantity = quantity + 1,
          collectible_name = excluded.collectible_name,
          updated_at = CURRENT_TIMESTAMP
      `).run(player.id, collectible.id, `${collectible.emoji} ${collectible.name}`);

      const row = db.prepare(`
        SELECT * FROM player_collectibles
        WHERE player_id = ? AND collectible_id = ?
      `).get(player.id, collectible.id);

      if (Number(row.quantity || 0) >= 10) {
        db.prepare(`
          UPDATE player_collectibles
          SET quantity = quantity - 10,
              completed_sets = completed_sets + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE player_id = ? AND collectible_id = ?
        `).run(player.id, collectible.id);
        collectible.reward(player.id);
        completionText = `🎉 Você completou 10x ${collectible.emoji} *${collectible.name}* e recebeu: *${collectible.completeText}*!`;
      }
    }
  })();

  const updated = getPlayerByWhatsAppId(player.whatsapp_id);
  return {
    ok: true,
    message: [
      '🎁 *Caixa aberta!*',
      '',
      `Caixa: *${box.label}*`,
      `Valor pago: *${money(box.price)} Zenies*`,
      `🎲 Multiplicador: *${formatMultiplier(rewardRoll.multiplier)}*`,
      `📊 Faixa sorteada: *${rewardRoll.tier}*`,
      `💰 Dinheiro encontrado: *${money(moneyReward)} Zenies*`,
      `📦 Caixas abertas hoje: *${openedToday + 1}/${BOX_DAILY_LIMIT}*`,
      collectible ? `🏺 Colecionável: ${collectible.emoji} *${collectible.name}*` : '🏺 Colecionável: nenhum dessa vez.',
      completionText,
      '',
      `Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].filter(Boolean).join('\n'),
  };
}

function caixa(message, argsText = '') {
  const action = String(argsText || '').trim().split(/\s+/)[0]?.toLowerCase();
  if (!action || ['lista', 'ver'].includes(action)) return listBoxes(message);
  if (['abrir', 'open'].includes(action)) return openBox(message, argsText);
  return openBox(message, argsText);
}

module.exports = {
  BOX_DAILY_LIMIT,
  BOX_COLLECTIBLE_CHANCE,
  NINE_COLLECTIBLE_OVERALL_CHANCE_PERCENT,
  BOXES,
  COLLECTIBLES,
  caixa,
  listBoxes,
  openBox,
};
