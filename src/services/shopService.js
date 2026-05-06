const db = require('../database/db');
const { money, formatKiLevel } = require('../utils/format');
const { shopItems, getKiPrice, findShopItem } = require('../data/shop');
const { KI_ATTRIBUTE_GAIN } = require('../data/roles');
const {
  getOrCreatePlayerFromMessage,
  getPlayerByWhatsAppId,
} = require('./playerService');
const { recordLedger } = require('./ledgerService');


function getActiveDiscount(playerId) {
  return db.prepare(`
    SELECT * FROM player_discounts
    WHERE player_id = ? AND uses > 0 AND percent > 0
  `).get(playerId);
}

function previewPurchaseDiscount(playerId, originalPrice) {
  const discount = getActiveDiscount(playerId);
  const price = Number(originalPrice || 0);
  if (!discount) {
    return { finalPrice: price, discountPercent: 0, discountAmount: 0, hasDiscount: false };
  }

  const percent = Math.max(0, Math.min(100, Number(discount.percent || 0)));
  const discountAmount = Math.floor(price * (percent / 100));
  const finalPrice = Math.max(0, price - discountAmount);
  return { finalPrice, discountPercent: percent, discountAmount, hasDiscount: true };
}

function consumePurchaseDiscount(playerId) {
  db.prepare(`
    UPDATE player_discounts
    SET uses = uses - 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ? AND uses > 0
  `).run(playerId);

  db.prepare(`DELETE FROM player_discounts WHERE player_id = ? AND uses <= 0`).run(playerId);
}

function applyPurchaseDiscount(playerId, originalPrice) {
  const preview = previewPurchaseDiscount(playerId, originalPrice);
  if (preview.hasDiscount) consumePurchaseDiscount(playerId);
  return preview;
}

function formatShop() {
  const lines = [
    '┏━━━━━━━━━━━━━┓',
    '             Loja',
    '┗━━━━━━━━━━━━━┛',
    '',
    '🔥 *Ups/Ki*',
    '',
    'A cada up de Ki, o player terá *+4.000.000* em todos seus atributos.',
    '',
    'Ki: 01',
    '> Este é o Ki inicial de todo Lutador do RPG onde para tê-lo não precisa pagar nada.',
    '',
    'Ki: 02',
    '> Preço: 750.000.000 Zenies',
    '',
    'Ki: 03',
    '> Preço: 1.250.000.000 Zenies',
    '',
    'Ki: 04',
    '> Preço: 1.600.000.000 Zenies',
    '',
    'Ki: 05',
    '> Preço: 2.750.000.000 Zenies',
    '',
    'Ki: 06',
    '> Preço: 3.500.000.000 Zenies',
    '',
    'Ki: 07',
    '> Preço: 4.600.000.000 Zenies',
    '',
    'Ki: 08',
    '> Preço: 5.000.000.000 Zenies',
    '',
    'Ki: 09',
    '> Preço: 7.500.000.000 Zenies',
    '',
    'Ki: 10',
    '> Preço: 10.000.000.000 Zenies',
    '',
    'Ki: 11+',
    '> A partir deste Ki em diante é necessário pagar: 10.000.000.000 Zenies',
    '',
    'Para comprar o próximo Ki, use: */comprar Ki*',
    '',
    '=================================',
    '',
    '🛒 *Itens*',
    '',
  ];

  for (const item of shopItems) {
    lines.push(
      `*${item.name}*`,
      '',
      `Rank: ${item.rank}`,
      '',
      item.type,
      '',
      `Legenda: ${item.description}`,
      '',
      `Preço: ${money(item.price)} Zenies`,
      '=================================',
      ''
    );
  }

  lines.push('Para comprar item, use: */comprar Nome do Item*');
  lines.push('Exemplos: */comprar Scouter* | */comprar Semente dos Deuses*');

  return { ok: true, message: lines.join('\n') };
}

function buyNextKi(message) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const currentKi = Number(player.ki_atual || 1);
  const nextKi = currentKi + 1;
  const originalPrice = getKiPrice(nextKi);
  const discount = previewPurchaseDiscount(player.id, originalPrice);
  const price = discount.finalPrice;

  if (player.zenies < price) {
    return {
      ok: false,
      message: [
        '❌ *Zenies insuficientes para comprar o próximo Ki.*',
        '',
        `🔥 Ki atual: *Ki ${formatKiLevel(currentKi)}*`,
        `🔥 Próximo Ki: *Ki ${formatKiLevel(nextKi)}*`,
        `💰 Preço: *${money(price)} Zenies*`,
        `💰 Seu saldo: *${money(player.zenies)} Zenies*`,
      ].join('\n'),
    };
  }

  db.prepare(`
    UPDATE players
    SET zenies = zenies - ?,
        ki_atual = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(price, nextKi, player.id);
  recordLedger({
    playerId: player.id,
    direction: 'saida',
    category: 'compra_ki',
    amount: price,
    description: `Compra de Ki ${formatKiLevel(nextKi)}`,
  });
  if (discount.hasDiscount) consumePurchaseDiscount(player.id);

  const updated = getPlayerByWhatsAppId(player.whatsapp_id);
  const atributos = Number(updated.ki_atual || 1) * KI_ATTRIBUTE_GAIN;

  return {
    ok: true,
    message: [
      '✅ *Ki comprado com sucesso!*',
      '',
      `🔥 Ki anterior: *Ki ${formatKiLevel(currentKi)}*`,
      `🔥 Novo Ki: *Ki ${formatKiLevel(updated.ki_atual)}*`,
      `💪 Atributos totais: *${money(atributos)}*`,
      discount.discountPercent > 0 ? `🏷️ Desconto aplicado: *${discount.discountPercent}%* (-${money(discount.discountAmount)} Zenies)` : null,
      `💸 Valor pago: *${money(price)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].filter(Boolean).join('\n'),
  };
}

function buyItem(message, itemName) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const item = findShopItem(itemName);

  if (!item) {
    return {
      ok: false,
      message: 'Item não encontrado na loja. Use */loja* para ver os itens disponíveis.',
    };
  }

  const discount = previewPurchaseDiscount(player.id, item.price);
  const price = discount.finalPrice;

  if (player.zenies < price) {
    return {
      ok: false,
      message: [
        '❌ *Zenies insuficientes para comprar esse item.*',
        '',
        `🛒 Item: *${item.name}*`,
        `💰 Preço: *${money(price)} Zenies*`,
        `💰 Seu saldo: *${money(player.zenies)} Zenies*`,
      ].join('\n'),
    };
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE players
      SET zenies = zenies - ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(price, player.id);

    db.prepare(`
      INSERT INTO player_inventory (player_id, item_id, item_name, quantity)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(player_id, item_id) DO UPDATE SET
        quantity = quantity + 1,
        item_name = excluded.item_name,
        updated_at = CURRENT_TIMESTAMP
    `).run(player.id, item.id, item.name);

    db.prepare(`
      INSERT INTO purchase_history (player_id, purchase_type, target_id, target_name, price)
      VALUES (?, 'item', ?, ?, ?)
    `).run(player.id, item.id, item.name, price);

    recordLedger({
      playerId: player.id,
      direction: 'saida',
      category: 'compra_item',
      amount: price,
      description: `Compra: ${item.name}`,
      metadata: { itemId: item.id, itemName: item.name },
    });

    if (discount.hasDiscount) consumePurchaseDiscount(player.id);
  });

  transaction();

  const updated = getPlayerByWhatsAppId(player.whatsapp_id);
  const inventory = db.prepare(`
    SELECT quantity FROM player_inventory
    WHERE player_id = ? AND item_id = ?
  `).get(player.id, item.id);

  return {
    ok: true,
    message: [
      '✅ *Compra realizada!*',
      '',
      `🛒 Item: *${item.name}*`,
      `🎖️ Rank: *${item.rank}*`,
      discount.discountPercent > 0 ? `🏷️ Desconto aplicado: *${discount.discountPercent}%* (-${money(discount.discountAmount)} Zenies)` : null,
      `💸 Valor pago: *${money(price)} Zenies*`,
      `📦 Quantidade no inventário: *${inventory?.quantity || 1}*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].filter(Boolean).join('\n'),
  };
}

function comprar(message, argsText) {
  const target = String(argsText || '').trim();
  if (!target) {
    return { ok: false, message: 'Use assim: */comprar Ki* ou */comprar Nome do Item*' };
  }

  if (/^ki$/i.test(target)) {
    return buyNextKi(message);
  }

  return buyItem(message, target);
}

function getInventory(message) {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const items = db.prepare(`
    SELECT item_name, quantity
    FROM player_inventory
    WHERE player_id = ? AND quantity > 0
    ORDER BY item_name COLLATE NOCASE ASC
  `).all(player.id);

  if (items.length === 0) {
    return { ok: true, message: '📦 Seu inventário está vazio.' };
  }

  const lines = [
    '┏━━━━━━━━━━━━━┓',
    '          Inventário',
    '┗━━━━━━━━━━━━━┛',
    '',
  ];

  for (const item of items) {
    lines.push(`📦 ${item.item_name}: *${item.quantity}x*`);
  }

  return { ok: true, message: lines.join('\n') };
}

module.exports = {
  formatShop,
  comprar,
  buyNextKi,
  buyItem,
  getInventory,
  getActiveDiscount,
  previewPurchaseDiscount,
  consumePurchaseDiscount,
  applyPurchaseDiscount,
};
