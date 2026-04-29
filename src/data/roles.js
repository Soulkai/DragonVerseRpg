const DAY_MS = 24 * 60 * 60 * 1000;

const ROLE_CATEGORIES = {
  SUPREME: 'supreme',
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
};

const roles = [
  {
    id: 'L.I',
    name: 'Lutador Iniciante',
    salary: 1_000_000,
    category: ROLE_CATEGORIES.PRIMARY,
    aliases: ['li', 'l.i', 'lutador', 'lutador iniciante', 'iniciante'],
  },
  {
    id: 'KAMI',
    name: 'Kami-sama',
    salary: 7_000_000,
    category: ROLE_CATEGORIES.PRIMARY,
    aliases: ['kami', 'kami-sama', 'kamisama', 'guardiao', 'guardião'],
  },
  {
    id: 'KAIOH',
    name: 'Kaioh',
    salary: 7_000_000,
    category: ROLE_CATEGORIES.PRIMARY,
    aliases: ['kaioh', 'kaio'],
  },
  {
    id: 'G.KAIOH',
    name: 'Grande Kaioh',
    salary: 10_000_000,
    category: ROLE_CATEGORIES.PRIMARY,
    aliases: ['g.kaioh', 'gkaioh', 'grande kaioh', 'grande kaio'],
  },
  {
    id: 'KAIO',
    name: 'Kaioshin',
    salary: 15_000_000,
    category: ROLE_CATEGORIES.PRIMARY,
    aliases: ['kaioshin', 'kaio-shin', 'kaioshin normal'],
  },
  {
    id: 'G.K',
    name: 'Grande Kaioshin',
    salary: 20_000_000,
    category: ROLE_CATEGORIES.SUPREME,
    aliases: ['g.k', 'gk', 'grande kaioshin', 'grande kaioshin', 'g kaioshin'],
  },
  {
    id: 'ANJO',
    name: 'Anjo',
    salary: 20_000_000,
    category: ROLE_CATEGORIES.SUPREME,
    aliases: ['anjo', 'angel'],
  },
  {
    id: 'HAKAI',
    name: 'Hakaishin',
    salary: 24_000_000,
    category: ROLE_CATEGORIES.SUPREME,
    aliases: ['hakai', 'hakaishin', 'deus da destruicao', 'deus da destruição'],
  },
  {
    id: 'S.M',
    name: 'Supremo Ministro',
    salary: 30_000_000,
    category: ROLE_CATEGORIES.SUPREME,
    aliases: ['s.m', 'sm', 'supremo ministro', 'ministro'],
  },
  {
    id: 'A.S',
    name: 'Autoridade Suprema',
    salary: 40_000_000,
    category: ROLE_CATEGORIES.SUPREME,
    aliases: ['a.s', 'as', 'autoridade suprema', 'autoridade'],
  },
  {
    id: 'L.E',
    name: 'Líder da Elaboração',
    salary: 10_000_000,
    category: ROLE_CATEGORIES.SECONDARY,
    aliases: ['l.e', 'le', 'lider elaboracao', 'líder elaboração', 'lider da elaboracao', 'líder da elaboração'],
  },
  {
    id: 'ELAB',
    name: 'Elaborador',
    salary: 7_000_000,
    category: ROLE_CATEGORIES.SECONDARY,
    aliases: ['elab', 'elaborador'],
  },
  {
    id: 'J.O',
    name: 'Juíz Oficial',
    salary: 20_000_000,
    category: ROLE_CATEGORIES.SECONDARY,
    aliases: ['j.o', 'jo', 'juiz', 'juíz', 'juiz oficial', 'juíz oficial'],
  },
  {
    id: 'RANK',
    name: 'Rankeador',
    salary: 15_000_000,
    category: ROLE_CATEGORIES.SECONDARY,
    aliases: ['rank', 'rankeador'],
  },
  {
    id: 'T.K',
    name: 'Treinador (Kaioh)',
    salary: 18_000_000,
    category: ROLE_CATEGORIES.SECONDARY,
    aliases: ['t.k', 'tk', 'treinador', 'treinador kaioh'],
  },
  {
    id: 'L.J',
    name: 'Líder do Jornal',
    salary: 24_000_000,
    category: ROLE_CATEGORIES.SECONDARY,
    aliases: ['l.j', 'lj', 'lider jornal', 'líder jornal', 'lider do jornal', 'líder do jornal'],
  },
  {
    id: 'JORNAL',
    name: 'Jornalista',
    salary: 20_000_000,
    category: ROLE_CATEGORIES.SECONDARY,
    aliases: ['jornal', 'jornalista'],
  },
  {
    id: 'SITE',
    name: 'Atualizador do site',
    salary: 10_000_000,
    category: ROLE_CATEGORIES.SECONDARY,
    aliases: ['site', 'atualizador', 'atualizador do site'],
  },
];

const roleById = new Map(roles.map((role) => [role.id, role]));

function normalizeRoleKey(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function getRoleById(id) {
  return roleById.get(String(id || '').trim().toUpperCase()) || null;
}

function findRole(input = '') {
  const raw = String(input || '').trim();
  const upper = raw.toUpperCase();
  if (roleById.has(upper)) return roleById.get(upper);

  const normalized = normalizeRoleKey(raw);
  return roles.find((role) => {
    if (normalizeRoleKey(role.id) === normalized) return true;
    if (normalizeRoleKey(role.name) === normalized) return true;
    return role.aliases.some((alias) => normalizeRoleKey(alias) === normalized);
  }) || null;
}

function isSupremeRoleId(roleId) {
  const role = getRoleById(roleId);
  return Boolean(role && role.category === ROLE_CATEGORIES.SUPREME);
}

function isHighCouncilRoleId(roleId) {
  return ['A.S', 'S.M'].includes(String(roleId || '').trim().toUpperCase());
}

function canAssignSupremeRoleId(roleId) {
  return isSupremeRoleId(roleId);
}

function calculateTotalSalary(primaryRoleId, secondaryRoleId = null) {
  const primary = getRoleById(primaryRoleId) || getRoleById('L.I');
  const secondary = secondaryRoleId ? getRoleById(secondaryRoleId) : null;
  return (primary?.salary || 0) + (secondary?.salary || 0);
}

const KI_ATTRIBUTE_GAIN = 4_000_000;
const SALARY_INTERVAL_DAYS = 2;
const DEPOSIT_INTEREST_INTERVAL_DAYS = 4;
const DEPOSIT_INTEREST_RATE = 0.25;
const INACTIVITY_LIMIT_MONTHS = 3;
const STARTING_ZENIES = 100_000_000;

module.exports = {
  DAY_MS,
  ROLE_CATEGORIES,
  roles,
  getRoleById,
  findRole,
  isSupremeRoleId,
  isHighCouncilRoleId,
  canAssignSupremeRoleId,
  calculateTotalSalary,
  KI_ATTRIBUTE_GAIN,
  SALARY_INTERVAL_DAYS,
  DEPOSIT_INTEREST_INTERVAL_DAYS,
  DEPOSIT_INTEREST_RATE,
  INACTIVITY_LIMIT_MONTHS,
  STARTING_ZENIES,
};
