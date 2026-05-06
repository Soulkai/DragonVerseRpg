const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { isSupremeRoleId } = require('../data/roles');
const { normalizeText, slugify } = require('../utils/text');
const { money } = require('../utils/format');
const { isAdmin } = require('../utils/admin');
const { recordLedger } = require('./ledgerService');
const {
  getOrCreatePlayerFromMessage,
  getWhatsAppIdFromMessage,
  getPlayerClaim,
} = require('./playerService');

const CHARACTER_SWAP_TAX_RATE = 0.25;

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
  if (!normalizedCode) {
    return { ok: false, message: 'Esse personagem está bloqueado. Envie um código de resgate para registrar.' };
  }

  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  if (!character) return { ok: false, message: 'Personagem não encontrado para validar o código.' };

  const rescue = db.prepare(`
    SELECT *
    FROM rescue_codes
    WHERE UPPER(code) = ?
      AND (
        (COALESCE(is_universal, 0) = 1 AND character_slug = ?)
        OR
        (COALESCE(is_universal, 0) = 0 AND universe_id = ? AND character_id = ?)
      )
    LIMIT 1
  `).get(normalizedCode, character.slug, universeId, characterId);

  if (!rescue) {
    return {
      ok: false,
      message: 'Código de resgate inválido para esse personagem ou universo.',
    };
  }

  if (rescue.used_at) return { ok: false, message: 'Esse código de resgate já foi usado.' };

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
    if (occupied) return { ok: false, message: `*${character.name}* já está ocupado no Universo ${universeId}.` };
  } else {
    const supremeOccupied = getSupremeClaimByCharacterSlug(character.slug);
    if (supremeOccupied) return { ok: false, message: `*${character.name}* já está sendo usado por alguém da Alta Cúpula.` };
  }

  if (character.is_locked) {
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

function findRepresentativeCharacterForCode(characterName, universeId = null) {
  const slug = slugify(characterName);
  if (!slug) return null;

  if (universeId) {
    return findCharacter(universeId, characterName);
  }

  const template = db.prepare('SELECT * FROM character_templates WHERE slug = ?').get(slug);
  const character = db.prepare(`
    SELECT *
    FROM characters
    WHERE slug = ?
    ORDER BY universe_id ASC
    LIMIT 1
  `).get(slug);

  if (!character && template) {
    return {
      id: null,
      universe_id: null,
      name: template.name,
      slug: template.slug,
      is_locked: template.is_locked,
    };
  }

  return character || null;
}

function generateRescueCode(message, universeId, characterName) {
  const universal = !universeId;
  let universeValidation = null;

  if (!universal) {
    universeValidation = validateUniverse(universeId);
    if (!universeValidation.ok) return universeValidation;
  }

  const character = findRepresentativeCharacterForCode(characterName, universal ? null : universeId);
  if (!character) {
    return {
      ok: false,
      message: universal
        ? `Não encontrei *${characterName}* na lista global de personagens.`
        : `Não encontrei *${characterName}* no Universo ${universeId}.`,
    };
  }

  if (!character.is_locked) {
    return { ok: false, message: `*${character.name}* não é bloqueado, então não precisa de código de resgate.` };
  }

  // A tabela rescue_codes antiga exige universe_id e character_id.
  // Para código universal, guardamos um personagem representante apenas para manter compatibilidade,
  // mas a validação real usa is_universal + character_slug.
  const representative = character.id
    ? character
    : db.prepare(`
        SELECT *
        FROM characters
        WHERE slug = ?
        ORDER BY universe_id ASC
        LIMIT 1
      `).get(character.slug);

  if (!representative?.id) {
    return { ok: false, message: `Não encontrei *${character.name}* em nenhum universo ativo para gerar o código.` };
  }

  const createdBy = getWhatsAppIdFromMessage(message);
  let code;
  let inserted = false;

  while (!inserted) {
    code = `DBV-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    try {
      db.prepare(`
        INSERT INTO rescue_codes (
          code,
          universe_id,
          character_id,
          is_universal,
          character_slug,
          character_name,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        code,
        representative.universe_id,
        representative.id,
        universal ? 1 : 0,
        character.slug,
        character.name,
        createdBy
      );
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
      universal ? '🌌 Validade: *qualquer universo*' : `🌌 Validade: *somente Universo ${universeId}*`,
      `🎟️ Código: *${code}*`,
      '',
      universal
        ? `Para usar: */Registro 2 ${character.name} ${code}*\nOu troque o número 2 pelo universo desejado.`
        : `Para usar: */Registro ${universeId} ${character.name} ${code}*`,
      `Para troca: */trocarpersonagem ${character.name} ${code}*`,
    ].join('\n'),
  };
}

function getProfile(message, targetWhatsappId = null) {
  const whatsappId = targetWhatsappId || getWhatsAppIdFromMessage(message);
  const player = db.prepare('SELECT * FROM players WHERE whatsapp_id = ?').get(whatsappId);

  if (!player) return { ok: false, message: 'Você ainda não tem perfil. Use */Registro 2 Nome do Personagem*.' };

  const claim = getPlayerClaim(player.id);
  if (!claim) return { ok: false, message: 'Você ainda não escolheu personagem. Use */Registro 2 Nome do Personagem*.' };

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

function splitUniverseAndName(argsText = '', player = null) {
  const parts = String(argsText).trim().split(/\s+/).filter(Boolean);
  let universeId = null;

  if (parts.length && /^\d+$/.test(parts[0])) {
    universeId = Number(parts.shift());
  }

  if (!universeId && player) {
    const claim = getPlayerClaim(player.id);
    if (claim) universeId = Number(claim.universe_id);
  }

  if (!universeId) universeId = 2;
  return { universeId, rest: parts.join(' ').trim() };
}

async function canManageCharacters(message, universeId) {
  if (await isAdmin(message)) return { ok: true };

  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const role = String(player.cargo_id || '').toUpperCase();
  if (['A.S', 'S.M'].includes(role)) return { ok: true };

  const claim = getPlayerClaim(player.id);
  const sameUniverse = claim && Number(claim.universe_id) === Number(universeId);
  if (sameUniverse && ['HAKAI', 'ANJO', 'G.K'].includes(role)) return { ok: true };

  return {
    ok: false,
    message: 'Apenas admins, Autoridade Suprema, Supremo Ministro ou líderes do próprio universo podem alterar a lista de personagens.',
  };
}

async function canManageGlobalCharacters(message) {
  if (await isAdmin(message)) return { ok: true };

  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const role = String(player.cargo_id || '').toUpperCase();
  if (['A.S', 'S.M'].includes(role)) return { ok: true };

  return {
    ok: false,
    message: 'Apenas admins, Autoridade Suprema ou Supremo Ministro podem alterar a lista global de personagens.',
  };
}

function parseGlobalCharacterArgs(argsText = '') {
  const parts = String(argsText || '').trim().split(/\s+/).filter(Boolean);

  // Compatibilidade com o formato antigo: /addpersonagem 3 Nome Free.
  // O número é ignorado porque agora a lista é global para todos os universos.
  if (parts.length && /^\d+$/.test(parts[0])) parts.shift();

  return parts.join(' ').trim();
}

function syncTemplateCharacterToAllUniverses(characterName, isLocked) {
  const slug = slugify(characterName);
  const imagePath = `assets/personagens/${slug}.png`;

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO character_templates (name, slug, is_locked, image_path)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        is_locked = excluded.is_locked,
        image_path = COALESCE(character_templates.image_path, excluded.image_path),
        updated_at = CURRENT_TIMESTAMP
    `).run(characterName, slug, isLocked ? 1 : 0, imagePath);

    const universes = db.prepare('SELECT id FROM universes WHERE is_active = 1').all();
    const upsert = db.prepare(`
      INSERT INTO characters (universe_id, name, slug, is_locked, image_path)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(universe_id, slug) DO UPDATE SET
        name = excluded.name,
        is_locked = excluded.is_locked,
        image_path = COALESCE(characters.image_path, excluded.image_path)
    `);

    for (const universe of universes) {
      upsert.run(universe.id, characterName, slug, isLocked ? 1 : 0, imagePath);
    }
  });

  transaction();
}

async function addCharacterToUniverse(message, argsText = '') {
  const permission = await canManageGlobalCharacters(message);
  if (!permission.ok) return permission;

  const raw = parseGlobalCharacterArgs(argsText);
  const match = raw.match(/\s+(block|blocked|bloqueado|lock|locked|free|livre)$/i);
  if (!match) {
    return {
      ok: false,
      message: 'Use assim: */addpersonagem Nome do Personagem Block* ou */addpersonagem Nome do Personagem Free*\nAgora esse comando altera todos os universos e os próximos universos criados.',
    };
  }

  const status = normalizeText(match[1]);
  const characterName = raw.slice(0, match.index).trim();
  if (!characterName) return { ok: false, message: 'Informe o nome do personagem.' };

  const isLocked = ['block', 'blocked', 'bloqueado', 'lock', 'locked'].includes(status);
  const slug = slugify(characterName);
  if (!slug) return { ok: false, message: 'Nome de personagem inválido.' };

  const existed = db.prepare('SELECT id FROM character_templates WHERE slug = ?').get(slug);
  syncTemplateCharacterToAllUniverses(characterName, isLocked);
  const universesUpdated = db.prepare('SELECT COUNT(*) AS total FROM universes WHERE is_active = 1').get().total || 0;

  return {
    ok: true,
    message: [
      existed ? '✅ *Personagem global atualizado!*' : '✅ *Personagem global adicionado!*',
      '',
      `👤 Personagem: *${characterName}*`,
      `Estado: *${isLocked ? 'Bloqueado 🔒' : 'Livre ⚪'}*`,
      `🌌 Universos atualizados: *${universesUpdated}*`,
      '',
      'Esse personagem também entrará automaticamente nos próximos universos criados.',
    ].join('\n'),
  };
}

async function removeCharacterFromUniverse(message, argsText = '') {
  const permission = await canManageGlobalCharacters(message);
  if (!permission.ok) return permission;

  const characterName = parseGlobalCharacterArgs(argsText).trim();
  if (!characterName) {
    return { ok: false, message: 'Use assim: */rmvpersonagem Nome do Personagem*\nAgora esse comando remove o personagem de todos os universos e dos próximos universos criados.' };
  }

  const slug = slugify(characterName);
  if (!slug) return { ok: false, message: 'Nome de personagem inválido.' };

  const existing = db.prepare('SELECT * FROM character_templates WHERE slug = ?').get(slug)
    || db.prepare('SELECT * FROM characters WHERE slug = ? LIMIT 1').get(slug);

  if (!existing) return { ok: false, message: `Não encontrei *${characterName}* na lista global de personagens.` };

  const affectedUniverses = db.prepare('SELECT COUNT(*) AS total FROM characters WHERE slug = ?').get(slug).total || 0;
  const claims = db.prepare(`
    SELECT COUNT(*) AS total
    FROM character_claims cc
    JOIN characters c ON c.id = cc.character_id
    WHERE c.slug = ?
  `).get(slug).total || 0;

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM character_templates WHERE slug = ?').run(slug);
    db.prepare('DELETE FROM characters WHERE slug = ?').run(slug);
  });

  transaction();

  return {
    ok: true,
    message: [
      '✅ *Personagem removido da lista global!*',
      '',
      `👤 Personagem: *${existing.name || characterName}*`,
      `🌌 Universos alterados: *${affectedUniverses}*`,
      claims > 0 ? `⚠️ Registros removidos junto com o personagem: *${claims}*` : null,
      '',
      'Esse personagem também não entrará nos próximos universos criados.',
    ].filter(Boolean).join('\n'),
  };
}

function trocarPersonagem(message, argsText = '') {
  const player = getOrCreatePlayerFromMessage(message, { touch: true });
  const claim = getPlayerClaim(player.id);
  if (!claim) {
    return { ok: false, message: 'Você ainda não tem personagem. Use */Registro 2 Nome do Personagem* primeiro.' };
  }

  const rawArgs = String(argsText || '').trim();
  if (!rawArgs) return { ok: false, message: 'Use assim: */trocarpersonagem Nome do Personagem*\nPara bloqueado: */trocarpersonagem Nome do Personagem CÓDIGO*' };

  const parts = rawArgs.split(/\s+/);
  const possibleCode = parts[parts.length - 1];
  const hasCode = /^DBV-[A-F0-9]{6}-[A-F0-9]{4}$/i.test(possibleCode);
  const rescueCode = hasCode ? possibleCode : null;
  const characterName = hasCode ? parts.slice(0, -1).join(' ').trim() : rawArgs;
  if (!characterName) return { ok: false, message: 'Informe o nome do personagem.' };

  const universeId = Number(claim.universe_id);
  const character = findCharacter(universeId, characterName);
  if (!character) {
    return { ok: false, message: `Não encontrei *${characterName}* no Universo ${universeId}. Use */Personagens ${universeId}*.` };
  }

  if (character.id === claim.character_id) return { ok: false, message: `Você já está usando *${character.name}*.` };

  const isSupreme = isSupremeRoleId(player.cargo_id);

  // Personagem bloqueado SEMPRE exige código de resgate.
  // Não existe bypass para admin, Autoridade Suprema, Supremo Ministro ou Alta Cúpula.
  if (character.is_locked) {
    const codeResult = consumeRescueCode({
      code: rescueCode,
      universeId,
      characterId: character.id,
      whatsappId: player.whatsapp_id,
    });

    if (!codeResult.ok) {
      return {
        ok: false,
        message: `${codeResult.message}

Formato para trocar para personagem bloqueado:
*/trocarpersonagem ${character.name} CÓDIGO*`,
      };
    }
  }

  if (!isSupreme) {
    const occupied = getClaimByCharacter(universeId, character.id, 'player');
    if (occupied) return { ok: false, message: `*${character.name}* já está ocupado no Universo ${universeId}.` };
  } else {
    const supremeOccupied = getSupremeClaimByCharacterSlug(character.slug);
    if (supremeOccupied && supremeOccupied.player_id !== player.id) {
      return { ok: false, message: `*${character.name}* já está sendo usado por alguém da Alta Cúpula.` };
    }
  }

  const cost = Math.floor(Number(player.zenies || 0) * CHARACTER_SWAP_TAX_RATE);
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE players
      SET zenies = MAX(zenies - ?, 0),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cost, player.id);

    db.prepare(`
      UPDATE character_claims
      SET character_id = ?,
          claim_type = ?
      WHERE id = ?
    `).run(character.id, isSupreme ? 'supremo' : 'player', claim.id);

    if (cost > 0) {
      recordLedger({
        playerId: player.id,
        direction: 'saida',
        category: 'troca_personagem',
        amount: cost,
        description: `Troca de personagem: ${claim.character_name} → ${character.name}`,
      });
    }
  });

  transaction();

  return {
    ok: true,
    message: [
      '🔁 *Personagem trocado com sucesso!*',
      '',
      `🌌 Universo: *${universeId}*`,
      `Antigo: *${claim.character_name}*`,
      `Novo: *${character.name}*`,
      `💸 Taxa de troca: *${money(cost)} Zenies*`,
      '',
      'A taxa equivale a *25%* dos seus Zenies atuais.',
    ].join('\n'),
  };
}

module.exports = {
  registerCharacter,
  listCharacters,
  generateRescueCode,
  getProfile,
  validateUniverse,
  addCharacterToUniverse,
  removeCharacterFromUniverse,
  trocarPersonagem,
};
