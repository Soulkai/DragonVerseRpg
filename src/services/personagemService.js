const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { isSupremeRoleId } = require('../data/roles');
const { normalizeText, slugify } = require('../utils/text');
const {
  getOrCreatePlayerFromMessage,
  getWhatsAppIdFromMessage,
  getPlayerClaim,
} = require('./playerService');

function validateUniverse(universeId) {
  if (!Number.isInteger(universeId)) {
    return { ok: false, message: 'Use assim: */Registro 2 Goku* ou */Personagens 2*' };
  }

  const universe = db.prepare('SELECT * FROM universes WHERE id = ? AND is_active = 1').get(universeId);
  if (!universe) {
    return { ok: false, message: `O Universo ${universeId} ainda não existe.` };
  }

  return { ok: true, universe };
}

function findCharacter(universeId, characterName) {
  const slug = slugify(characterName);
  return db.prepare('SELECT * FROM characters WHERE universe_id = ? AND slug = ?').get(universeId, slug);
}

function getClaimByCharacter(universeId, characterId, claimType = 'player') {
  return db.prepare(`
    SELECT cc.*, p.display_name, p.phone
    FROM character_claims cc
    JOIN players p ON p.id = cc.player_id
    WHERE cc.universe_id = ? AND cc.character_id = ? AND cc.claim_type = ?
  `).get(universeId, characterId, claimType);
}

function getSupremeClaimByCharacterSlug(characterSlug) {
  return db.prepare(`
    SELECT cc.*, p.display_name, p.phone, c.name AS character_name
    FROM character_claims cc
    JOIN players p ON p.id = cc.player_id
    JOIN characters c ON c.id = cc.character_id
    WHERE cc.claim_type = 'supremo'
      AND c.slug = ?
    LIMIT 1
  `).get(characterSlug);
}

function consumeRescueCode({ code, universeId, characterId, whatsappId }) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return { ok: false, message: 'Esse personagem está bloqueado. Envie um código de resgate para registrar.' };

  const rescue = db.prepare(`
    SELECT * FROM rescue_codes
    WHERE code = ? AND universe_id = ? AND character_id = ?
  `).get(normalizedCode, universeId, characterId);

  if (!rescue) {
    return { ok: false, message: 'Código de resgate inválido para esse personagem.' };
  }

  if (rescue.used_at) {
    return { ok: false, message: 'Esse código de resgate já foi usado.' };
  }

  db.prepare(`
    UPDATE rescue_codes
    SET redeemed_by = ?, used_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(whatsappId, rescue.id);

  return { ok: true };
}

function registerCharacter(message, universeId, characterName, rescueCode = null) {
  const universeValidation = validateUniverse(universeId);
  if (!universeValidation.ok) return universeValidation;

  const character = findCharacter(universeId, characterName);
  if (!character) {
    return { ok: false, message: `Não encontrei *${characterName}* no Universo ${universeId}. Use */Personagens ${universeId}* para ver a lista.` };
  }

  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const oldClaim = getPlayerClaim(player.id);
  if (oldClaim) {
    return {
      ok: false,
      message: `Você já está registrado como *${oldClaim.character_name}* no *${oldClaim.universe_name}*.`,
    };
  }

  const isSupreme = isSupremeRoleId(player.cargo_id);
  const claimType = isSupreme ? 'supremo' : 'player';

  if (!isSupreme) {
    const occupied = getClaimByCharacter(universeId, character.id, 'player');
    if (occupied) {
      return { ok: false, message: `*${character.name}* já está ocupado no Universo ${universeId}.` };
    }
  } else {
    const supremeOccupied = getSupremeClaimByCharacterSlug(character.slug);
    if (supremeOccupied) {
      return { ok: false, message: `*${character.name}* já está sendo usado por alguém da Alta Cúpula.` };
    }
  }

  if (character.is_locked && !isSupreme) {
    const codeResult = consumeRescueCode({
      code: rescueCode,
      universeId,
      characterId: character.id,
      whatsappId: player.whatsapp_id,
    });

    if (!codeResult.ok) {
      return {
        ok: false,
        message: `${codeResult.message}\n\nFormato para personagem bloqueado:\n*/Registro ${universeId} ${character.name} CÓDIGO*`,
      };
    }
  }

  db.prepare(`
    INSERT INTO character_claims (player_id, universe_id, character_id, claim_type)
    VALUES (?, ?, ?, ?)
  `).run(player.id, universeId, character.id, claimType);

  return {
    ok: true,
    message: [
      '✅ *Registro concluído!*',
      '',
      `🌌 Universo: *${universeId}*`,
      `👤 Personagem: *${character.name}*`,
      isSupreme ? '👑 Alta Cúpula: esse personagem não ocupou vaga comum do universo.' : null,
      '',
      'Use */Perfil* para ver seus dados.',
    ].filter(Boolean).join('\n'),
  };
}

function listCharacters(universeId) {
  const universeValidation = validateUniverse(universeId);
  if (!universeValidation.ok) return universeValidation;

  const rows = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.is_locked,
      CASE WHEN cc.id IS NULL THEN 0 ELSE 1 END AS occupied
    FROM characters c
    LEFT JOIN character_claims cc
      ON cc.universe_id = c.universe_id
      AND cc.character_id = c.id
      AND cc.claim_type = 'player'
    WHERE c.universe_id = ?
    ORDER BY c.name COLLATE NOCASE ASC
  `).all(universeId);

  const grouped = new Map();
  for (const row of rows) {
    const letter = normalizeText(row.name).charAt(0).toUpperCase();
    if (!grouped.has(letter)) grouped.set(letter, []);
    grouped.get(letter).push(row);
  }

  const lines = [
    '┏━━━━━━━━━━━━━┓',
    `           Universo ${universeId}`,
    '┗━━━━━━━━━━━━━┛',
    universeValidation.universe.welcome_text,
    '',
    'Obs:. personagens lendários só são adquiridos se você se mostrar ativo no RPG e demonstrar domínio sobre lutas',
    '',
    'Personagens livre⚪',
    'Personagens ocupado⚫',
    'Personagens lendários, raros e de conquistas🔒',
    '',
  ];

  const sortedLetters = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  for (const letter of sortedLetters) {
    lines.push(`❖ ── ✦ ──『✙${letter}✙』── ✦ ── ❖`, '');

    for (const row of grouped.get(letter)) {
      const emoji = row.occupied ? '⚫' : row.is_locked ? '🔒' : '⚪';
      lines.push(`${emoji}${row.name}`);
    }

    lines.push('');
  }

  lines.push('*❖ ── ✦ ──『🈵』── ✦ ── ❖*');

  return { ok: true, message: lines.join('\n') };
}

function generateRescueCode(message, universeId, characterName) {
  const universeValidation = validateUniverse(universeId);
  if (!universeValidation.ok) return universeValidation;

  const character = findCharacter(universeId, characterName);
  if (!character) {
    return { ok: false, message: `Não encontrei *${characterName}* no Universo ${universeId}.` };
  }

  if (!character.is_locked) {
    return { ok: false, message: `*${character.name}* não é bloqueado, então não precisa de código de resgate.` };
  }

  const createdBy = getWhatsAppIdFromMessage(message);
  let code;
  let inserted = false;

  while (!inserted) {
    code = `DBV-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    try {
      db.prepare(`
        INSERT INTO rescue_codes (code, universe_id, character_id, created_by)
        VALUES (?, ?, ?, ?)
      `).run(code, universeId, character.id, createdBy);
      inserted = true;
    } catch (error) {
      if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error;
    }
  }

  return {
    ok: true,
    message: [
      '🔑 *Código de resgate gerado!*',
      '',
      `👤 Personagem: *${character.name}*`,
      `🌌 Universo: *${universeId}*`,
      `🎟️ Código: *${code}*`,
      '',
      `Para usar: */Registro ${universeId} ${character.name} ${code}*`,
    ].join('\n'),
  };
}

function getProfile(message) {
  const whatsappId = getWhatsAppIdFromMessage(message);
  const player = db.prepare('SELECT * FROM players WHERE whatsapp_id = ?').get(whatsappId);

  if (!player) {
    return { ok: false, message: 'Você ainda não tem perfil. Use */Registro 2 Nome do Personagem*.' };
  }

  const claim = getPlayerClaim(player.id);
  if (!claim) {
    return { ok: false, message: 'Você ainda não escolheu personagem. Use */Registro 2 Nome do Personagem*.' };
  }

  const profile = {
    ...player,
    universe_id: claim.universe_id,
    character_name: claim.character_name,
    image_path: claim.image_path,
  };

  let absoluteImagePath = null;
  if (profile.image_path) {
    const candidate = path.resolve(process.cwd(), profile.image_path);
    if (fs.existsSync(candidate)) absoluteImagePath = candidate;
  }

  return { ok: true, profile, imagePath: absoluteImagePath };
}

module.exports = {
  registerCharacter,
  listCharacters,
  generateRescueCode,
  getProfile,
  validateUniverse,
};
