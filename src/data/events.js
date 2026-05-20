const MANUAL_EVENT_REWARD = 50_000_000;
const MANUAL_DAILY_LIMIT = 10;
const MANUAL_DAILY_REWARD_LIMIT = 500_000_000;
const DRAGON_EMOJI_REWARD = 50_000_000;
const DRAGON_EMOJI_DAILY_LIMIT_PER_CHAT = 10;
const AUTO_QUIZ_REWARD = 100_000_000;
const AUTO_QUIZ_DAILY_LIMIT_PER_CHAT = 10;
const DRAGON_EMOJI_INTERVAL_MINUTES = 60;
const ACTIVE_EVENT_EXPIRATION_MINUTES = 50;
const AUTO_QUIZ_HOURS = Array.from({ length: 19 }, (_, index) => index + 5);

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

  {
    question: 'Qual personagem sacrificou a própria vida usando o Makankosappo contra Raditz?',
    options: { A: 'Piccolo', B: 'Goku', C: 'Kuririn', D: 'Tenshinhan' },
    answer: 'B',
  },
  {
    question: 'Qual é o nome do planeta natal dos Saiyajins na era de Vegeta?',
    options: { A: 'Namekusei', B: 'Sadala', C: 'Vegeta', D: 'Yardrat' },
    answer: 'C',
  },
  {
    question: 'Quem treinou Goku em Yardrat para aprender o teletransporte?',
    options: { A: 'Whis', B: 'Mestre Kame', C: 'Habitantes de Yardrat', D: 'Senhor Kaioh' },
    answer: 'C',
  },
  {
    question: 'Qual técnica Vegeta usa como ataque explosivo contra Cell Perfeito?',
    options: { A: 'Final Flash', B: 'Kamehameha', C: 'Masenko', D: 'Taiyoken' },
    answer: 'A',
  },
  {
    question: 'Quem derrotou Cell com o Kamehameha Pai e Filho?',
    options: { A: 'Goku', B: 'Gohan', C: 'Vegeta', D: 'Trunks' },
    answer: 'B',
  },
  {
    question: 'Qual personagem é conhecido por usar o Masenko ainda criança?',
    options: { A: 'Goten', B: 'Gohan', C: 'Trunks', D: 'Uub' },
    answer: 'B',
  },
  {
    question: 'Qual é o nome da fusão de Caulifla e Kale?',
    options: { A: 'Kefla', B: 'Gogeta', C: 'Vegetto', D: 'Gotenks' },
    answer: 'A',
  },
  {
    question: 'Qual guerreiro do Universo 6 é aprendiz de Vegeta?',
    options: { A: 'Hit', B: 'Cabba', C: 'Frost', D: 'Botamo' },
    answer: 'B',
  },
  {
    question: 'Qual personagem é o irmão gêmeo de Bills?',
    options: { A: 'Champa', B: 'Belmod', C: 'Rumsshi', D: 'Sidra' },
    answer: 'A',
  },
  {
    question: 'Quem é a anja assistente de Champa?',
    options: { A: 'Marcarita', B: 'Vados', C: 'Kusu', D: 'Cognac' },
    answer: 'B',
  },
  {
    question: 'Quem é o Supremo Kaioshin ligado ao universo de Bills?',
    options: { A: 'Shin', B: 'Zamasu', C: 'Gowasu', D: 'Kibito' },
    answer: 'A',
  },
  {
    question: 'Qual vilão rouba o corpo de Goku em Dragon Ball Super?',
    options: { A: 'Moro', B: 'Zamasu', C: 'Granolah', D: 'Gas' },
    answer: 'B',
  },
  {
    question: 'Qual personagem usa a técnica Hakai como poder de destruição?',
    options: { A: 'Hakaishins', B: 'Kaioshins', C: 'Namekuseijins', D: 'Patrulheiros Galácticos' },
    answer: 'A',
  },
  {
    question: 'Qual vilão de Dragon Ball Super é conhecido por devorar energia e planetas?',
    options: { A: 'Moro', B: 'Cell', C: 'Freeza', D: 'Baby' },
    answer: 'A',
  },
  {
    question: 'Quem é o sobrevivente Cerealiano que deseja vingança contra os Saiyajins?',
    options: { A: 'Gas', B: 'Granolah', C: 'Jiren', D: 'Toppo' },
    answer: 'B',
  },
  {
    question: 'Quem é um dos membros mais fortes da família Heeter?',
    options: { A: 'Gas', B: 'Cabba', C: 'Dyspo', D: 'Frost' },
    answer: 'A',
  },
  {
    question: 'Qual transformação de Freeza aparece em Dragon Ball Super com aparência dourada?',
    options: { A: 'Black Freeza', B: 'Golden Freeza', C: 'Freeza Perfeito', D: 'Freeza Oozaru' },
    answer: 'B',
  },
  {
    question: 'Qual personagem usa a técnica Mafuba para selamento?',
    options: { A: 'Mestre Kame', B: 'Nappa', C: 'Broly', D: 'Janemba' },
    answer: 'A',
  },
  {
    question: 'Quem foi absorvido por Super Buu para formar Buutenks?',
    options: { A: 'Vegetto', B: 'Gotenks', C: 'Gohan', D: 'Piccolo apenas' },
    answer: 'B',
  },
  {
    question: 'Quem foi absorvido por Super Buu para formar Buuhan?',
    options: { A: 'Gohan', B: 'Goten', C: 'Trunks', D: 'Vegeta' },
    answer: 'A',
  },
  {
    question: 'Qual personagem é a reencarnação humana bondosa de Kid Buu?',
    options: { A: 'Uub', B: 'Pan', C: 'Goten', D: 'Cabba' },
    answer: 'A',
  },
  {
    question: 'Quem é a filha de Gohan e Videl?',
    options: { A: 'Bra', B: 'Pan', C: 'Marron', D: 'Mai' },
    answer: 'B',
  },
  {
    question: 'Qual técnica de Tenshinhan cria um ataque triangular de energia?',
    options: { A: 'Kikoho', B: 'Kamehameha', C: 'Final Flash', D: 'Death Beam' },
    answer: 'A',
  },
  {
    question: 'Qual personagem é conhecido pelo golpe Yamcha chamado Sokidan?',
    options: { A: 'Yamcha', B: 'Kuririn', C: 'Piccolo', D: 'Tao Pai Pai' },
    answer: 'A',
  },
  {
    question: 'Qual item de Bulma é usado para localizar as Esferas do Dragão?',
    options: { A: 'Radar do Dragão', B: 'Scouter', C: 'Bastão Mágico', D: 'Nuvem Voadora' },
    answer: 'A',
  },
  {
    question: 'Qual item mágico de Goku cresce conforme sua vontade?',
    options: { A: 'Bastão Mágico', B: 'Semente dos Deuses', C: 'Scouter', D: 'Radar' },
    answer: 'A',
  },
  {
    question: 'Quem é o mestre que vive na Torre Karin?',
    options: { A: 'Karin', B: 'Kami-sama', C: 'Kaioh', D: 'Whis' },
    answer: 'A',
  },
  {
    question: 'Quem é o guardião da Terra antes de Dende assumir?',
    options: { A: 'Kami-sama', B: 'Piccolo Daimaoh', C: 'Mestre Kame', D: 'Senhor Kaioh' },
    answer: 'A',
  },
  {
    question: 'Qual Namekuseijin assume como novo guardião da Terra?',
    options: { A: 'Nail', B: 'Dende', C: 'Cargo', D: 'Moori' },
    answer: 'B',
  },
  {
    question: 'Quem é o pai de Trunks do Futuro?',
    options: { A: 'Goku', B: 'Vegeta', C: 'Gohan', D: 'Yamcha' },
    answer: 'B',
  },
  {
    question: 'Qual personagem corta a espada Z ao testar sua resistência?',
    options: { A: 'Gohan', B: 'Bills', C: 'Goku', D: 'Kaioh' },
    answer: 'A',
  },
  {
    question: 'Qual entidade aparece ao quebrar a Espada Z?',
    options: { A: 'Velho Kaioshin', B: 'Shenlong', C: 'Porunga', D: 'Zeno' },
    answer: 'A',
  },
  {
    question: 'Quem é o rei de todos os universos em Dragon Ball Super?',
    options: { A: 'Zeno', B: 'Daishinkan', C: 'Bills', D: 'Gowasu' },
    answer: 'A',
  },
  {
    question: 'Quem é o Grande Sacerdote, pai dos anjos?',
    options: { A: 'Daishinkan', B: 'Zeno', C: 'Whis', D: 'Gowasu' },
    answer: 'A',
  },
  {
    question: 'Qual luta popularizou o Instinto Superior de Goku no Torneio do Poder?',
    options: { A: 'Goku contra Jiren', B: 'Vegeta contra Cabba', C: 'Gohan contra Cell', D: 'Freeza contra Frost' },
    answer: 'A',
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

  { word: 'FINAL FLASH', hint: 'Ataque poderoso usado por Vegeta.' },
  { word: 'MAKANKOSAPPO', hint: 'Técnica perfurante de Piccolo.' },
  { word: 'KIENZAN', hint: 'Disco cortante usado por Kuririn.' },
  { word: 'TAIYOKEN', hint: 'Golpe de luz usado para cegar o adversário.' },
  { word: 'MASENKO', hint: 'Técnica de energia usada por Gohan.' },
  { word: 'GALICK HO', hint: 'Ataque clássico de Vegeta.' },
  { word: 'BIG BANG ATTACK', hint: 'Explosão de energia associada a Vegeta.' },
  { word: 'TELETRANSPORTE', hint: 'Técnica aprendida em Yardrat.' },
  { word: 'YARDRAT', hint: 'Planeta ligado ao teletransporte de Goku.' },
  { word: 'SADALA', hint: 'Planeta ligado à origem dos Saiyajins.' },
  { word: 'PLANETA VEGETA', hint: 'Planeta dos Saiyajins na era do rei Vegeta.' },
  { word: 'TORNEIO DO PODER', hint: 'Competição entre universos.' },
  { word: 'INSTINTO SUPERIOR', hint: 'Estado em que o corpo reage sozinho.' },
  { word: 'SUPER SAIYAJIN BLUE', hint: 'Forma divina de cabelo azul.' },
  { word: 'GOLDEN FREEZA', hint: 'Transformação dourada de Freeza.' },
  { word: 'GOKU BLACK', hint: 'Inimigo ligado a Zamasu.' },
  { word: 'ZAMASU', hint: 'Kaioshin aprendiz corrompido.' },
  { word: 'MORO', hint: 'Vilão devorador de energia.' },
  { word: 'GRANOLAH', hint: 'Sobrevivente Cerealiano.' },
  { word: 'GAS', hint: 'Membro poderoso dos Heeter.' },
  { word: 'KEFLA', hint: 'Fusão de Caulifla e Kale.' },
  { word: 'VEGETTO', hint: 'Fusão Potara de Goku e Vegeta.' },
  { word: 'GOGETA', hint: 'Fusão por dança de Goku e Vegeta.' },
  { word: 'GOTENKS', hint: 'Fusão de Goten e Trunks.' },
  { word: 'PORUNGA', hint: 'Dragão das Esferas de Namekusei.' },
  { word: 'SHENLONG', hint: 'Dragão invocado pelas Esferas da Terra.' },
  { word: 'RADAR DO DRAGAO', hint: 'Aparelho de Bulma para encontrar esferas.' },
  { word: 'BASTAO MAGICO', hint: 'Arma clássica de Goku criança.' },
  { word: 'NUVEM VOADORA', hint: 'Meio de transporte mágico usado por Goku.' },
  { word: 'SEMENTE DOS DEUSES', hint: 'Item que restaura energia e ferimentos.' },
  { word: 'HAKAI', hint: 'Poder de destruição dos Hakaishins.' },
  { word: 'MAFUBA', hint: 'Técnica de selamento.' },
  { word: 'BUUHAN', hint: 'Super Buu após absorver Gohan.' },
  { word: 'BUUTENKS', hint: 'Super Buu após absorver Gotenks.' },
  { word: 'UUB', hint: 'Reencarnação humana bondosa de Kid Buu.' },
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
