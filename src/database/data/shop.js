const KI_PRICES = new Map([
  [2, 300_000_000],
  [3, 500_000_000],
  [4, 640_000_000],
  [5, 1_100_000_000],
  [6, 1_400_000_000],
  [7, 1_840_000_000],
  [8, 2_000_000_000],
  [9, 3_000_000_000],
  [10, 4_000_000_000],
]);

function getKiPrice(nextKiLevel) {
  const level = Number(nextKiLevel || 0);
  if (level <= 1) return 0;
  return KI_PRICES.get(level) || 6_000_000_000;
}

const shopItems = [
  {
    id: 'semente-dos-deuses',
    name: 'Semente dos Deuses',
    rank: 'Sss',
    type: 'Def: Recuperação',
    price: 4_000_000_000,
    aliases: ['semente', 'sementes', 'semente dos deuses', 'sementes dos deuses', 'senzu'],
    description:
      'Sementes dos Deuses são criadas por Mestre Karin na Torre Karin. Quando são comidas, a energia e saúde física do usuário é restaurada até o máximo; esses efeitos são tipicamente quase instantâneos, fazendo dessas sementes um grande trunfo dentro e fora da batalha (Velocidade instantânea)(Quando utilizado o usuário recupera todo seu Hp, podendo até mesmo se curar durante a luta)(Não funciona em selamentos, desintegração, dano extremo e que destroem planeta)(não funciona se já estiver morto)(Recupera 2x de uso de todas as suas habilidades exceto as de uso único)(Uso Único)',
  },
  {
    id: 'scouter',
    name: 'Scouter',
    rank: 'C',
    type: 'Suplementar',
    price: 140_000_000,
    aliases: ['scouter', 'rastreador'],
    description:
      'O Scouter, conhecido como rastreador, é um aparelho que serve para medir o poder de luta do adversário ou descobrir determinada localização. O Scouter também serve para comunicação, um exemplo é quando Raditz estava prestes a morrer e se comunicou com seus companheiros Saiyajins, Nappa e Vegeta, que iam para à Terra (Equipa-se em Rank 6 de velocidade)(quando ativo, o usuário se torna sensor de ki)(uso único)',
  },
  {
    id: 'nave-espacial',
    name: 'Nave Espacial',
    rank: 'A',
    type: 'Suplementar',
    price: 1_400_000_000,
    aliases: ['nave', 'nave espacial', 'capsula espacial', 'cápsula espacial'],
    description:
      'São naves redondas e pequenas, utilizadas principalmente pelos Saiyajins e o Exército Galático de Freeza para se deslocarem pelo universo. Também foi adotada pelo exército de Freeza na conquista de mundos. (funciona como Teletransporte Planetário)(Considera-se Rank 4 de Velocidade)(escapa de qualquer atk, exceto aqueles que necessitam de teletransportes)(leva apenas o usuário)(pode 5x)',
  },
  {
    id: 'cauda-saiyajin',
    name: 'Cauda Saiyajin',
    rank: 'A',
    type: 'Suplementar',
    price: 400_000_000,
    aliases: ['cauda', 'cauda saiyajin', 'rabo', 'rabo saiyajin'],
    description:
      '(apenas Saiyajins que tenha a forma Oozaru em sua loja com exceção de Baby, pode utilizar a cauda) Todos os Saiyajins puros nascem com caudas, similares às de macaco e cobertas por pelo marrom. A cauda é uma área sensível para Saiyajins que não treinaram. Quando apertada, ela causa grande dor, e temporariamente paralisa o corpo inteiro (ativa-se em Rank 6 de Velocidade)(quando ativo o usuário poderá se transformar nas formas oozarus)(se a cauda for cortada ou removida, a forma Oozaru é desativada)(se o oponente destruir a lua a forma também será anulada)(uso único e fica ativo pelo resto da batalha)',
  },
  {
    id: 'nuvem-voadora',
    name: 'Nuvem Voadora',
    rank: 'A',
    type: 'Suplementar',
    price: 400_000_000,
    aliases: ['nuvem', 'nuvem voadora', 'kinto un', 'kintoun'],
    description:
      'É uma nuvem amarela mágica que serve como meio de transporte. Goku obtém a nuvem de Mestre Kame por compensação de ter salvado a Tartaruga. Ela serve a Goku e seus filhos agindo como uma maneira de voar em velocidade alta sem usar nenhuma energia (Ativa-se em Rank 5 de velocidade)(Quando ativo o usuário ganha capacidade de voo)(Pode levar mais 1 aliado)(Modos gigantes, Modos Malignos e Majins não podem utilizar a nuvem)(Pode utilizar teleporte por 5x sendo Rank 4 de Velocidade)(Uso Único)',
  },
];

function normalizeItemSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function findShopItem(input = '') {
  const normalized = normalizeItemSearch(input);
  if (!normalized) return null;

  return shopItems.find((item) => {
    if (normalizeItemSearch(item.id) === normalized) return true;
    if (normalizeItemSearch(item.name) === normalized) return true;
    return item.aliases.some((alias) => normalizeItemSearch(alias) === normalized);
  }) || null;
}

module.exports = {
  KI_PRICES,
  getKiPrice,
  shopItems,
  findShopItem,
};
