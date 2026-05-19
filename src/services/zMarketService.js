const db = require('../database/db');
const { normalizeText, slugify } = require('../utils/text');
const { getOrCreatePlayerFromMessage, getPlayerByWhatsAppId } = require('./playerService');
const { ensureRankedProfile, rankedProfile } = require('./rankedService');

const Z_ITEMS = [
  {
    id: 'colera-do-dragao-estelar',
    name: 'Cólera do Dragão Estelar',
    price: 250,
    kiRequired: 1,
    rank: 'Z+',
    type: 'Atk/Def/Hp: +20.000.000',
    aliases: ['colera', 'cólera', 'colera do dragao estelar', 'cólera do dragão estelar', 'dragao estelar'],
    description: '(Requer Ki 01) Uma técnica lendária que canaliza a energia do combatente em uma forma líquida e volátil, semelhante à fúria de uma estrela em colapso. (Aumenta 1 Rank de velocidade em todas as técnicas do usuário)(Aumenta 1 categoria do Rank de todas habilidades do usuário)(Dura 5 turnos)(Ki 08 torna técnicas em Global)(Teleporte 5x Rank 5)(3x por batalha)(2 turnos de recarga)'
  },
  {
    id: 'sombra-espelhante',
    name: 'Sombra Espelhante',
    price: 400,
    kiRequired: 6,
    rank: 'Z+',
    type: 'Suplementar',
    aliases: ['sombra', 'sombra espelhante'],
    description: '(Requer Ki 06) Uma forma humanoide negra sai da sombra do usuário copiando forma, habilidades e atributos. Dura 6 turnos, Rank 6 para criar, até 2 clones, 2x por batalha.'
  },
  {
    id: 'ponta-do-relampago',
    name: 'Ponta do Relâmpago',
    price: 150,
    kiRequired: 3,
    rank: 'Z+',
    type: 'Atk/Def/Hp: +5.000.000',
    aliases: ['ponta', 'ponta do relampago', 'ponta do relâmpago', 'relampago', 'relâmpago'],
    description: '(Requer Ki 03) Técnica de velocidade pura. Aumenta 1 Rank de velocidade, dura 3 turnos, 3x por batalha, ataques letais se tornam ilimitados, 1 turno de recarga.'
  }
];

const AUX_COMMON_PRICE = 500;
const AUX_LEGENDARY_PRICE = 800;

function findZItem(input = '') {
  const key = normalizeText(input);
  return Z_ITEMS.find((item) => normalizeText(item.id) === key || normalizeText(item.name) === key || item.aliases.some((a) => normalizeText(a) === key)) || null;
}

function zMarket() {
  const lines = [
    '╭━━⪩ 🛒 *Z MARKET DRAGONVERSE* ⪨━━',
    '▢',
    '▢ • Moeda: *PC* — Pontos de Compra da Rankeada.',
    '▢ • Use */Zbuy nome* para comprar uma habilidade.',
    '▢',
    '▢ *Habilidades:*',
  ];

  for (const item of Z_ITEMS) {
    lines.push(
      '▢',
      `▢ • *${item.name}* — ${item.price} PC`,
      `▢   Rank: ${item.rank}`,
      `▢   Requer Ki: ${String(item.kiRequired).padStart(2, '0')}`,
      `▢   ${item.type}`,
      `▢   ${item.description}`
    );
  }

  lines.push(
    '▢',
    '▢ *Personagem Auxiliar:*',
    `▢ • Auxiliar comum: *${AUX_COMMON_PRICE} PC*`,
    `▢ • Auxiliar lendário: *${AUX_LEGENDARY_PRICE} PC*`,
    '▢ • Pode escolher qualquer personagem da lista, bloqueado ou livre.',
    '▢ • Dura 3 meses.',
    '▢',
    '▢ Exemplos:',
    '▢ • */Zbuy Ponta do Relâmpago*',
    '▢ • */Zbuy auxiliar comum Goku*',
    '▢ • */Zbuy auxiliar lendario Broly DBS*',
    '╰━━─「🛒」─━━'
  );

  return { ok: true, message: lines.join('\n') };
}

function getCharacterTemplateByName(name = '') {
  const key = slugify(name);
  if (!key) return null;
  return db.prepare(`SELECT * FROM character_templates WHERE slug = ?`).get(key)
    || db.prepare(`SELECT * FROM characters WHERE slug = ? ORDER BY universe_id LIMIT 1`).get(key);
}

function spendPc(playerId, amount) {
  db.prepare(`
    UPDATE ranked_profiles
    SET pc = pc - ?, updated_at = CURRENT_TIMESTAMP
    WHERE player_id = ?
  `).run(amount, playerId);
}

function addZInventory(playerId, itemId, itemName, expiresAt = null) {
  db.prepare(`
    INSERT INTO zmarket_purchases (player_id, item_id, item_name, price_pc, expires_at)
    VALUES (?, ?, ?, 0, ?)
  `).run(playerId, itemId, itemName, expiresAt);

  db.prepare(`
    INSERT INTO player_inventory (player_id, item_id, item_name, quantity)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(player_id, item_id) DO UPDATE SET
      quantity = quantity + 1,
      item_name = excluded.item_name,
      updated_at = CURRENT_TIMESTAMP
  `).run(playerId, itemId, itemName);
}

function zBuy(message, argsText = '') {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  ensureRankedProfile(player.id);
  const profile = rankedProfile(player.id);
  const input = String(argsText || '').trim();
  if (!input) return { ok: false, message: 'Use assim: */Zbuy nome* ou */Zbuy auxiliar comum Goku*' };

  const normalized = normalizeText(input);
  if (normalized.startsWith('auxiliar ')) {
    const parts = input.split(/\s+/);
    const kind = normalizeText(parts[1] || '');
    const characterName = parts.slice(2).join(' ').trim();
    const legendary = ['lendario', 'lendário', 'l'].includes(kind);
    const common = ['comum', 'c'].includes(kind);
    if (!legendary && !common) return { ok: false, message: 'Use: */Zbuy auxiliar comum Nome* ou */Zbuy auxiliar lendario Nome*' };
    if (!characterName) return { ok: false, message: 'Informe o personagem auxiliar. Exemplo: */Zbuy auxiliar comum Goku*' };
    const character = getCharacterTemplateByName(characterName);
    if (!character) return { ok: false, message: 'Não encontrei esse personagem na lista global.' };
    const price = legendary ? AUX_LEGENDARY_PRICE : AUX_COMMON_PRICE;
    if (profile.pc < price) return { ok: false, message: `PC insuficiente. Você tem *${profile.pc} PC* e precisa de *${price} PC*.` };
    const expiresAt = db.prepare("SELECT datetime('now', '+3 months') AS expires_at").get().expires_at;
    db.transaction(() => {
      spendPc(player.id, price);
      db.prepare(`
        INSERT INTO zmarket_purchases (player_id, item_id, item_name, price_pc, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(player.id, `aux-${legendary ? 'lendario' : 'comum'}-${character.slug}`, `Auxiliar ${legendary ? 'Lendário' : 'Comum'}: ${character.name}`, price, expiresAt);
      db.prepare(`
        INSERT INTO player_inventory (player_id, item_id, item_name, quantity)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(player_id, item_id) DO UPDATE SET quantity = quantity + 1, item_name = excluded.item_name, updated_at = CURRENT_TIMESTAMP
      `).run(player.id, `aux-${legendary ? 'lendario' : 'comum'}-${character.slug}`, `Auxiliar ${legendary ? 'Lendário' : 'Comum'}: ${character.name}`);
    })();
    const updated = rankedProfile(player.id);
    return { ok: true, message: [`✅ *Auxiliar comprado!*`, '', `👤 Personagem: *${character.name}*`, `Tipo: *${legendary ? 'Lendário' : 'Comum'}*`, `Preço: *${price} PC*`, `Expira em: *${new Date(`${expiresAt.replace(' ', 'T')}Z`).toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' })}*`, `PC atual: *${updated.pc}*`].join('\n') };
  }

  const item = findZItem(input);
  if (!item) return { ok: false, message: 'Item não encontrado. Use */ZMarket* para ver a lista.' };
  if (Number(player.ki_atual || 1) < item.kiRequired) return { ok: false, message: `Essa habilidade requer *Ki ${String(item.kiRequired).padStart(2, '0')}*. Seu Ki atual é *Ki ${String(player.ki_atual || 1).padStart(2, '0')}*.` };
  if (profile.pc < item.price) return { ok: false, message: `PC insuficiente. Você tem *${profile.pc} PC* e precisa de *${item.price} PC*.` };

  db.transaction(() => {
    spendPc(player.id, item.price);
    db.prepare(`
      INSERT INTO zmarket_purchases (player_id, item_id, item_name, price_pc)
      VALUES (?, ?, ?, ?)
    `).run(player.id, item.id, item.name, item.price);
    db.prepare(`
      INSERT INTO player_inventory (player_id, item_id, item_name, quantity)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(player_id, item_id) DO UPDATE SET quantity = quantity + 1, item_name = excluded.item_name, updated_at = CURRENT_TIMESTAMP
    `).run(player.id, `z-${item.id}`, item.name);
  })();

  const updated = rankedProfile(player.id);
  return { ok: true, message: [`✅ *Compra no Z Market realizada!*`, '', `📜 Habilidade: *${item.name}*`, `Preço: *${item.price} PC*`, `PC atual: *${updated.pc}*`].join('\n') };
}

module.exports = { zMarket, zBuy, Z_ITEMS };
