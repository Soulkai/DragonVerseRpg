const db = require('../database/db');
const { money, formatKiLevel } = require('../utils/format');
const { shopItems, getKiPrice, findShopItem } = require('../data/shop');
const { KI_ATTRIBUTE_GAIN } = require('../data/roles');
const {
  getOrCreatePlayerFromMessage,
  getPlayerByWhatsAppId,
} = require('./playerService');

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
    '> Preço: 150.000.000 Zenies',
    '',
    'Ki: 03',
    '> Preço: 250.000.000 Zenies',
    '',
    'Ki: 04',
    '> Preço: 320.000.000 Zenies',
    '',
    'Ki: 05',
    '> Preço: 550.000.000 Zenies',
    '',
    'Ki: 06',
    '> Preço: 700.000.000 Zenies',
    '',
    'Ki: 07',
    '> Preço: 920.000.000 Zenies',
    '',
    'Ki: 08',
    '> Preço: 1.000.000.000 Zenies',
    '',
    'Ki: 09',
    '> Preço: 1.500.000.000 Zenies',
    '',
    'Ki: 10',
    '> Preço: 2.000.000.000 Zenies',
    '',
    'Ki: 11+',
    '> A partir deste Ki em diante é necessário pagar: 2.000.000.000 Zenies',
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
  const price = getKiPrice(nextKi);

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
      `💸 Valor pago: *${money(price)} Zenies*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].join('\n'),
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

  if (player.zenies < item.price) {
    return {
      ok: false,
      message: [
        '❌ *Zenies insuficientes para comprar esse item.*',
        '',
        `🛒 Item: *${item.name}*`,
        `💰 Preço: *${money(item.price)} Zenies*`,
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
    `).run(item.price, player.id);

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
    `).run(player.id, item.id, item.name, item.price);
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
      `💸 Valor pago: *${money(item.price)} Zenies*`,
      `📦 Quantidade no inventário: *${inventory?.quantity || 1}*`,
      `💰 Saldo atual: *${money(updated.zenies)} Zenies*`,
    ].join('\n'),
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
};
