# DragonVerse WhatsApp Bot

Bot para RPG de Dragon Ball usando **Node.js**, **whatsapp-web.js** e **SQLite**.

## O que esta versão já tem

- Registro de personagem por universo.
- Personagens livres, ocupados e bloqueados.
- Código de resgate para personagens lendários/bloqueados.
- Banco SQL local em SQLite.
- Comandos de admin para Zenies, Ki, cargos e universos.
- Sistema de cargos principais, cargos supremos e trabalhos secundários.
- Salário automático a cada 2 dias.
- Depósito com juros de 25% a cada 4 dias.
- Loja com compra de Ki e itens especiais.
- Inventário SQL para guardar itens comprados.
- Sistema de eventos manuais com limite diário.
- Perguntas de Dragon Ball com alternativas A, B, C e D.
- Forca de Dragon Ball.
- Eventos automáticos de emoji do dragão e pergunta relâmpago.
- Remoção automática do personagem após 3 meses de inatividade.
- Perfil com foto, personagem, Ki, atributos totais, Zenies, depósito, cargo, trabalho e salário.

## Instalação

```bash
npm install
cp .env.example .env
npm start
```

No primeiro start, escaneie o QR Code no terminal usando o WhatsApp.

## Configuração de admins

No `.env`, coloque os números administradores em formato internacional, sem `+`, sem espaço e sem traços:

```env
ADMIN_NUMBERS=5567999999999,5567888888888
```

Admins do `.env` podem usar os comandos administrativos mesmo sem cargo dentro do RPG.

## Configuração de fuso horário

O bot usa o fuso horário para resetar limites diários de eventos:

```env
TIMEZONE=America/Campo_Grande
```

## Comandos de jogador

```txt
/Personagens 2
/Registro 2 Goku
/Registro 2 Bardock DBV-XXXXXX-XXXX
/Perfil
/loja
/comprar Ki
/comprar Scouter
/comprar Semente dos Deuses
/inventario
/depositar 50000000
/cargos
/eventos
/eventos pergunta
/eventos forca
/eventos desafio
/responder A
/letra A
/chutar Kamehameha
/pegar
/help
```

## Comandos administrativos

```txt
/addzenies @pessoa 50000000
/retirarzenies @pessoa 50000000
/definirki @pessoa 5
/addcargo @pessoa A.S
/adduniverso 3
/codigoresgate 2 Bardock
/eventos ativar
/eventos desativar
```

## Eventos

Use:

```txt
/eventos
```

O bot mostra a lista de eventos e o status diário do jogador.

### Eventos manuais

Cada jogador pode participar de até **10 eventos manuais por dia**.

Cada acerto vale:

```txt
10.000.000 Zenies
```

Máximo diário em eventos manuais:

```txt
100.000.000 Zenies
```

Se errar, não ganha nada e o evento é encerrado.

### Perguntas e respostas

```txt
/eventos pergunta
/responder A
```

O bot sorteia uma pergunta de Dragon Ball com alternativas A, B, C e D.

### Forca

```txt
/eventos forca
/letra A
/chutar Kamehameha
```

O bot sorteia uma palavra de Dragon Ball. O jogador tem 6 erros possíveis.

### Desafio rápido

```txt
/eventos desafio
/responder B
```

O bot sorteia uma situação rápida do RPG para o jogador resolver.

### Eventos automáticos

Para ativar eventos automáticos no grupo atual, um admin usa:

```txt
/eventos ativar
```

Para desativar:

```txt
/eventos desativar
```

#### Pegue o emoji

A cada hora, o bot pode mandar um emoji de dragão no chat:

```txt
🐉
```

O primeiro jogador que mandar:

```txt
/pegar
```

ganha:

```txt
5.000.000 Zenies
```

O bot envia no máximo **10 emojis por dia por chat**.

#### Pergunta relâmpago

Em 3 horários do dia, o bot pode mandar uma pergunta aleatória.

O primeiro jogador que responder corretamente com:

```txt
/responder A
```

ganha:

```txt
25.000.000 Zenies
```

Por padrão, as perguntas relâmpago são tentadas nos horários locais:

```txt
10h, 16h e 21h
```

## Loja

Use:

```txt
/loja
```

O bot mostra a tabela de Ki e os itens disponíveis.

### Comprar Ki

```txt
/comprar Ki
```

Esse comando compra sempre o **próximo Ki** do jogador.

Tabela de preços:

```txt
Ki 01 = grátis
Ki 02 = 150.000.000 Zenies
Ki 03 = 250.000.000 Zenies
Ki 04 = 320.000.000 Zenies
Ki 05 = 550.000.000 Zenies
Ki 06 = 700.000.000 Zenies
Ki 07 = 920.000.000 Zenies
Ki 08 = 1.000.000.000 Zenies
Ki 09 = 1.500.000.000 Zenies
Ki 10 = 2.000.000.000 Zenies
Ki 11+ = 2.000.000.000 Zenies por nível
```

### Itens da loja

```txt
Semente dos Deuses = 2.000.000.000 Zenies
Scouter = 70.000.000 Zenies
Nave Espacial = 700.000.000 Zenies
Cauda Saiyajin = 200.000.000 Zenies
Nuvem Voadora = 200.000.000 Zenies
```

Exemplos:

```txt
/comprar Scouter
/comprar Nave Espacial
/comprar Cauda Saiyajin
/comprar Nuvem Voadora
/comprar Semente dos Deuses
```

Os itens comprados ficam salvos em `player_inventory`.

## Inventário

Use:

```txt
/inventario
```

O bot mostra quantos itens o jogador possui.

## Permissões de cargos

### Cargos Supremos

Estes cargos não ocupam personagem comum do universo. O personagem deles entra na lista da Alta Cúpula e não pode se repetir entre outros cargos supremos.

- `A.S` — Autoridade Suprema
- `S.M` — Supremo Ministro
- `HAKAI` — Hakaishin
- `ANJO` — Anjo
- `G.K` — Grande Kaioshin

Apenas **Autoridade Suprema**, **Supremo Ministro** ou admins do `.env` podem adicionar cargos supremos.

### Lideranças de universo

Hakaishin, Anjo e Grande Kaioshin podem adicionar cargos não supremos a jogadores do próprio universo.

### Cargos principais

- `L.I` — Lutador Iniciante
- `KAMI` — Kami-sama
- `KAIOH` — Kaioh
- `G.KAIOH` — Grande Kaioh
- `KAIO` — Kaioshin

### Trabalhos / cargos secundários

- `L.E` — Líder da Elaboração
- `ELAB` — Elaborador
- `J.O` — Juíz Oficial
- `RANK` — Rankeador
- `T.K` — Treinador (Kaioh)
- `L.J` — Líder do Jornal
- `JORNAL` — Jornalista
- `SITE` — Atualizador do site

## Salários

O salário cai automaticamente a cada 2 dias, quando o bot estiver rodando. O bot também verifica pagamentos pendentes ao iniciar.

Se o jogador tiver um cargo principal e um trabalho secundário, o salário total mostrado no perfil é a soma dos dois.

## Depósito

Use:

```txt
/depositar 50000000
```

O valor sai dos Zenies disponíveis e entra no depósito. A cada 4 dias, o depósito gera 25% de juros que vão para o saldo de Zenies.

## Ki e atributos

Todo jogador começa com:

```txt
Ki 01
100.000.000 Zenies
```

Cada nível de Ki vale `+4.000.000` em atributos totais.

Exemplo:

```txt
Ki 01 = 4.000.000 atributos
Ki 05 = 20.000.000 atributos
```

## Inatividade

Se uma conta ficar 3 meses sem usar comandos do bot, o personagem dela é apagado automaticamente e volta a ficar livre.

## Banco de dados

O SQLite é criado automaticamente em:

```txt
data/dragonverse.sqlite
```

Tabelas principais:

```txt
universes
characters
players
character_claims
rescue_codes
player_inventory
purchase_history
event_daily_stats
event_chats
event_chat_daily_stats
active_events
```

## Fotos dos personagens

Coloque imagens PNG nesta pasta:

```txt
assets/personagens/
```

O nome precisa ser o slug do personagem. Exemplos:

```txt
assets/personagens/goku.png
assets/personagens/android-17.png
assets/personagens/broly-dbs.png
assets/personagens/dragao-de-uma-estrela.png
```

Se a imagem não existir, o comando `/Perfil` envia apenas o texto e mostra o caminho esperado.
