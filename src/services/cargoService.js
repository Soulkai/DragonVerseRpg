const db = require('../database/db');
const { isAdmin } = require('../utils/admin');
const { getFirstMentionedId, removeFirstMention } = require('../utils/mentions');
const { money } = require('../utils/format');
const {
  ROLE_CATEGORIES,
  roles,
  findRole,
  getRoleById,
  isHighCouncilRoleId,
  canAssignSupremeRoleId,
  calculateTotalSalary,
} = require('../data/roles');
const {
  getOrCreatePlayerFromMessage,
  getOrCreatePlayerByWhatsAppId,
  getPlayerClaim,
} = require('./playerService');

function canAssignCargo(actorPlayer, targetPlayer, roleToAssign, message) {
  if (isAdmin(message)) return { ok: true, reason: 'admin' };

  const actorRoleId = actorPlayer?.cargo_id;
  if (isHighCouncilRoleId(actorRoleId)) return { ok: true, reason: 'alta-cupula' };

  if (['HAKAI', 'ANJO', 'G.K'].includes(actorRoleId)) {
    if (canAssignSupremeRoleId(roleToAssign.id)) {
      return {
        ok: false,
        message: 'Apenas *Autoridade Suprema* ou *Supremo Ministro* podem adicionar cargos supremos.',
      };
    }

    const actorClaim = getPlayerClaim(actorPlayer.id);
    const targetClaim = getPlayerClaim(targetPlayer.id);

    if (!actorClaim || !targetClaim || actorClaim.universe_id !== targetClaim.universe_id) {
      return {
        ok: false,
        message: 'Hakaishin, Anjo e Grande Kaioshin só podem adicionar cargos a jogadores do próprio universo.',
      };
    }

    return { ok: true, reason: 'lider-universal' };
  }

  return {
    ok: false,
    message: 'Você não tem permissão para adicionar cargos.',
  };
}

function setPlayerRole(targetPlayer, role) {
  const currentPrimaryRoleId = targetPlayer.cargo_id || 'L.I';
  const currentSecondaryRoleId = targetPlayer.trabalho_id || null;

  const nextPrimaryRoleId = role.category === ROLE_CATEGORIES.SECONDARY ? currentPrimaryRoleId : role.id;
  const nextSecondaryRoleId = role.category === ROLE_CATEGORIES.SECONDARY ? role.id : currentSecondaryRoleId;
  const primary = getRoleById(nextPrimaryRoleId) || getRoleById('L.I');
  const secondary = nextSecondaryRoleId ? getRoleById(nextSecondaryRoleId) : null;
  const totalSalary = calculateTotalSalary(nextPrimaryRoleId, nextSecondaryRoleId);

  db.prepare(`
    UPDATE players
    SET cargo_id = ?,
        cargo = ?,
        trabalho_id = ?,
        trabalho = ?,
        salario = ?,
        last_salary_at = COALESCE(last_salary_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    primary.id,
    primary.name,
    secondary?.id || null,
    secondary?.name || 'Nenhum',
    totalSalary,
    targetPlayer.id,
  );

  return db.prepare('SELECT * FROM players WHERE id = ?').get(targetPlayer.id);
}

function addCargo(message, argsText) {
  const targetWhatsappId = getFirstMentionedId(message, argsText);
  if (!targetWhatsappId) {
    return { ok: false, message: 'Use assim: */addcargo @pessoa A.S* ou */addcargo @pessoa Kaioshin*' };
  }

  const rest = removeFirstMention(argsText);
  if (!rest) {
    return { ok: false, message: 'Informe o ID ou nome do cargo. Exemplo: */addcargo @pessoa Hakai*' };
  }

  const role = findRole(rest);
  if (!role) {
    return { ok: false, message: `Não encontrei o cargo *${rest}*. Use */cargos* para ver os IDs.` };
  }

  const actor = getOrCreatePlayerFromMessage(message, { touch: true });
  const target = getOrCreatePlayerByWhatsAppId(targetWhatsappId, null, { touch: false });

  const permission = canAssignCargo(actor, target, role, message);
  if (!permission.ok) return permission;

  const updated = setPlayerRole(target, role);

  return {
    ok: true,
    message: [
      '✅ *Cargo atualizado!*',
      '',
      `👤 Jogador: @${updated.phone}`,
      role.category === ROLE_CATEGORIES.SECONDARY
        ? `🛠️ Trabalho: *${updated.trabalho}*`
        : `🎖️ Cargo: *${updated.cargo}*`,
      `💵 Salário total: *${money(updated.salario)} Zenies* a cada 2 dias`,
    ].join('\n'),
  };
}

function listRoles() {
  const lines = [
    '🎖️ *Cargos DragonVerse*',
    '',
    '*Cargos Supremos:*',
  ];

  for (const role of roles.filter((item) => item.category === ROLE_CATEGORIES.SUPREME)) {
    lines.push(`• *${role.id}* — ${role.name} — ${money(role.salary)} Zenies`);
  }

  lines.push('', '*Cargos Principais:*');
  for (const role of roles.filter((item) => item.category === ROLE_CATEGORIES.PRIMARY)) {
    lines.push(`• *${role.id}* — ${role.name} — ${money(role.salary)} Zenies`);
  }

  lines.push('', '*Cargos Secundários / Trabalhos:*');
  for (const role of roles.filter((item) => item.category === ROLE_CATEGORIES.SECONDARY)) {
    lines.push(`• *${role.id}* — ${role.name} — ${money(role.salary)} Zenies`);
  }

  lines.push('', 'Use: */addcargo @pessoa ID_DO_CARGO*');
  return { ok: true, message: lines.join('\n') };
}

module.exports = {
  addCargo,
  listRoles,
};
