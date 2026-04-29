const MANUAL_EVENT_REWARD = 10_000_000;
const MANUAL_DAILY_LIMIT = 10;
const MANUAL_DAILY_REWARD_LIMIT = 100_000_000;
const DRAGON_EMOJI_REWARD = 5_000_000;
const DRAGON_EMOJI_DAILY_LIMIT_PER_CHAT = 10;
const AUTO_QUIZ_REWARD = 25_000_000;
const AUTO_QUIZ_DAILY_LIMIT_PER_CHAT = 3;
const DRAGON_EMOJI_INTERVAL_MINUTES = 60;
const ACTIVE_EVENT_EXPIRATION_MINUTES = 50;
const AUTO_QUIZ_HOURS = [10, 16, 21];

const quizQuestions = [
  {
    question: 'Quem foi o primeiro Super Saiyajin mostrado na história principal de Dragon Ball Z?',
    options: { A: 'Vegeta', B: 'Goku', C: 'Trunks do Futuro', D: 'Bardock' },
    answer: 'B',
  },
  {
    question: 'Qual técnica é a marca registrada de Goku?',
    options: { A: 'Galick Ho', B: 'Makankosappo', C: 'Kamehameha', D: 'Final Flash' },
    answer: 'C',
  },
  {
    question: 'Quem criou os Androides 17 e 18?',
    options: { A: 'Dr. Gero', B: 'Bulma', C: 'Dr. Briefs', D: 'Babadi' },
    answer: 'A',
  },
  {
    question: 'Qual vilão absorve os Androides 17 e 18 para alcançar sua forma perfeita?',
    options: { A: 'Majin Buu', B: 'Cell', C: 'Freeza', D: 'Baby' },
    answer: 'B',
  },
  {
    question: 'Quem é o Deus da Destruição do Universo 7?',
    options: { A: 'Champa', B: 'Belmod', C: 'Bills', D: 'Sidra' },
    answer: 'C',
  },
  {
    question: 'Quem é o anjo assistente de Bills?',
    options: { A: 'Whis', B: 'Vados', C: 'Mojito', D: 'Marcarita' },
    answer: 'A',
  },
  {
    question: 'Qual transformação de Goku usa energia divina e cabelo azul?',
    options: { A: 'Super Saiyajin 3', B: 'Super Saiyajin God', C: 'Super Saiyajin Blue', D: 'Instinto Superior' },
    answer: 'C',
  },
  {
    question: 'Qual raça é conhecida por ficar mais forte após se recuperar de ferimentos graves?',
    options: { A: 'Namekuseijins', B: 'Saiyajins', C: 'Majins', D: 'Androides' },
    answer: 'B',
  },
  {
    question: 'Qual personagem usa a técnica Makankosappo?',
    options: { A: 'Piccolo', B: 'Kuririn', C: 'Yamcha', D: 'Tenshinhan' },
    answer: 'A',
  },
  {
    question: 'Qual técnica de Kuririn corta praticamente qualquer coisa?',
    options: { A: 'Kienzan', B: 'Taiyoken', C: 'Genki Dama', D: 'Big Bang Attack' },
    answer: 'A',
  },
  {
    question: 'Quem foi o primeiro inimigo de Goku em Dragon Ball Z?',
    options: { A: 'Vegeta', B: 'Nappa', C: 'Raditz', D: 'Freeza' },
    answer: 'C',
  },
  {
    question: 'Qual esfera do dragão Gohan usava no chapéu quando criança?',
    options: { A: 'Uma estrela', B: 'Duas estrelas', C: 'Quatro estrelas', D: 'Sete estrelas' },
    answer: 'C',
  },
  {
    question: 'Quem matou Freeza na Terra na linha principal antes dos eventos dos Androides?',
    options: { A: 'Goku', B: 'Trunks do Futuro', C: 'Vegeta', D: 'Piccolo' },
    answer: 'B',
  },
  {
    question: 'Quem ensina a técnica Kaioken para Goku?',
    options: { A: 'Mestre Kame', B: 'Kami-sama', C: 'Senhor Kaioh', D: 'Whis' },
    answer: 'C',
  },
  {
    question: 'Qual personagem é conhecido como Príncipe dos Saiyajins?',
    options: { A: 'Goku', B: 'Gohan', C: 'Vegeta', D: 'Broly' },
    answer: 'C',
  },
  {
    question: 'Quem é a fusão de Goku e Vegeta usando brincos Potara?',
    options: { A: 'Gogeta', B: 'Vegetto', C: 'Gotenks', D: 'Kefla' },
    answer: 'B',
  },
  {
    question: 'Quem é a fusão de Goten e Trunks?',
    options: { A: 'Gotenks', B: 'Vegetto', C: 'Gogeta', D: 'Kefla' },
    answer: 'A',
  },
  {
    question: 'Qual torneio reúne guerreiros de vários universos em Dragon Ball Super?',
    options: { A: 'Torneio de Cell', B: 'Torneio do Poder', C: 'Tenkaichi Budokai', D: 'Torneio dos Kaioshins' },
    answer: 'B',
  },
  {
    question: 'Quem é o guerreiro mais famoso do Universo 11?',
    options: { A: 'Hit', B: 'Cabba', C: 'Jiren', D: 'Frost' },
    answer: 'C',
  },
  {
    question: 'Qual personagem do Universo 6 é assassino e usa salto temporal?',
    options: { A: 'Hit', B: 'Frost', C: 'Cabba', D: 'Botamo' },
    answer: 'A',
  },
  {
    question: 'Qual técnica reúne energia dos seres vivos para formar uma esfera gigantesca?',
    options: { A: 'Final Flash', B: 'Genki Dama', C: 'Masenko', D: 'Death Beam' },
    answer: 'B',
  },
  {
    question: 'Quem é o mestre clássico de Goku e Kuririn?',
    options: { A: 'Mestre Karin', B: 'Mestre Kame', C: 'Senhor Popo', D: 'Kaioh' },
    answer: 'B',
  },
  {
    question: 'Onde as Sementes dos Deuses/Senzu são cultivadas na tradição clássica?',
    options: { A: 'Torre Karin', B: 'Planeta Namekusei', C: 'Templo de Kami-sama', D: 'Planeta Vegeta' },
    answer: 'A',
  },
  {
    question: 'Qual é a forma gigante dos Saiyajins transformados pela lua cheia?',
    options: { A: 'Oozaru', B: 'Majin', C: 'Golden', D: 'Kaioken' },
    answer: 'A',
  },
  {
    question: 'Quem é o criador de Majin Buu?',
    options: { A: 'Bibidi', B: 'Babadi', C: 'Dr. Gero', D: 'Moro' },
    answer: 'A',
  },
  {
    question: 'Quem desperta Majin Buu na saga Buu?',
    options: { A: 'Bibidi', B: 'Babadi', C: 'Dabura', D: 'Freeza' },
    answer: 'B',
  },
  {
    question: 'Qual personagem ficou famoso pelo golpe Taiyoken?',
    options: { A: 'Tenshinhan', B: 'Yamcha', C: 'Raditz', D: 'Nappa' },
    answer: 'A',
  },
  {
    question: 'Qual planeta natal de Piccolo e Kami-sama?',
    options: { A: 'Terra', B: 'Vegeta', C: 'Namekusei', D: 'Sadala' },
    answer: 'C',
  },
  {
    question: 'Quem é conhecido por usar o Final Flash?',
    options: { A: 'Goku', B: 'Vegeta', C: 'Gohan', D: 'Broly' },
    answer: 'B',
  },
  {
    question: 'Qual personagem é a versão maligna de Goku ligada a Zamasu?',
    options: { A: 'Turles', B: 'Goku Black', C: 'Cumber', D: 'Baby Goku' },
    answer: 'B',
  },
];

const hangmanWords = [
  { word: 'KAMEHAMEHA', hint: 'Técnica clássica ensinada por Mestre Kame.' },
  { word: 'VEGETA', hint: 'Príncipe dos Saiyajins.' },
  { word: 'NAMEKUSEI', hint: 'Planeta natal de Piccolo e Kami-sama.' },
  { word: 'MAJIN BUU', hint: 'Criatura mágica despertada por Babadi.' },
  { word: 'GENKI DAMA', hint: 'Técnica que reúne energia dos seres vivos.' },
  { word: 'FREEZA', hint: 'Imperador galáctico derrotado em Namekusei.' },
  { word: 'GOHAN', hint: 'Filho mais velho de Goku.' },
  { word: 'BILLS', hint: 'Deus da Destruição do Universo 7.' },
  { word: 'WHIS', hint: 'Anjo assistente de Bills.' },
  { word: 'SCOUTER', hint: 'Aparelho usado para medir poder de luta.' },
  { word: 'OOZARU', hint: 'Transformação gigante dos Saiyajins.' },
  { word: 'ANDROIDES', hint: 'Criações ligadas ao Dr. Gero.' },
  { word: 'KAIOKEN', hint: 'Técnica ensinada pelo Senhor Kaioh.' },
  { word: 'JIREN', hint: 'Guerreiro poderoso do Universo 11.' },
  { word: 'HIT', hint: 'Assassino do Universo 6 que usa salto temporal.' },
];

const quickChallenges = [
  {
    title: 'Treino de Gravidade',
    text: 'Você entrou na sala de gravidade. Escolha a pressão correta para não quebrar o próprio corpo.',
    options: { A: '10x', B: '100x', C: '1.000x sem aquecimento', D: 'Dormir no chão' },
    answer: 'B',
  },
  {
    title: 'Patrulha Cósmica',
    text: 'Uma nave suspeita apareceu próxima ao planeta. Qual atitude mantém o universo seguro?',
    options: { A: 'Ignorar', B: 'Investigar antes de atacar', C: 'Explodir o planeta', D: 'Fugir sem avisar ninguém' },
    answer: 'B',
  },
  {
    title: 'Defesa do Universo',
    text: 'Um inimigo está carregando um ataque em área. O que é mais estratégico?',
    options: { A: 'Proteger civis e interromper a carga', B: 'Mandar figurinha', C: 'Esperar acertar', D: 'Atacar aliados' },
    answer: 'A',
  },
  {
    title: 'Caçada às Esferas',
    text: 'O radar encontrou uma esfera em uma caverna instável. Qual caminho parece mais seguro?',
    options: { A: 'Entrar gritando', B: 'Usar sensor de Ki e avançar com cautela', C: 'Destruir a caverna', D: 'Vender o radar' },
    answer: 'B',
  },
  {
    title: 'Teste de Mestre Karin',
    text: 'Karin oferece uma Semente dos Deuses. Quando ela deve ser usada?',
    options: { A: 'Depois de morto', B: 'Contra selamento absoluto', C: 'Para recuperar energia e ferimentos em combate', D: 'Para comprar Ki' },
    answer: 'C',
  },
];

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
  MANUAL_EVENT_REWARD,
  MANUAL_DAILY_LIMIT,
  MANUAL_DAILY_REWARD_LIMIT,
  DRAGON_EMOJI_REWARD,
  DRAGON_EMOJI_DAILY_LIMIT_PER_CHAT,
  AUTO_QUIZ_REWARD,
  AUTO_QUIZ_DAILY_LIMIT_PER_CHAT,
  DRAGON_EMOJI_INTERVAL_MINUTES,
  ACTIVE_EVENT_EXPIRATION_MINUTES,
  AUTO_QUIZ_HOURS,
  quizQuestions,
  hangmanWords,
  quickChallenges,
  randomFrom,
};
