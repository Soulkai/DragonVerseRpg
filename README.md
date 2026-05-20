<div align="center">

<img src="https://readme-typing-svg.herokuapp.com/?font=mono&size=28&duration=4000&color=FF6600&center=true&vCenter=true&lines=🐉+DragonVerse+RPG+Bot+🐉;⚡+WhatsApp+%2B+Node.js+%2B+SQLite;🎮+O+RPG+de+Dragon+Ball+no+ZAP!">

<br>

<img src="https://i.ibb.co/7tt6TWsq/ea3a8268-06c2-4f54-bea1-e2e1ecfc444b.png" alt="DragonVerse Bot v2.0.0" width="1080">

<br><br>

<a href="#"><img title="BOT-MULTI-DEVICE" src="https://img.shields.io/badge/BOT•MULTI•DEVICE-blueviolet?&style=for-the-badge&logo=whatsapp&logoColor=white"></a>

<br><br>

<img title="Autor" src="https://img.shields.io/badge/Autor-@Soulkai-orange?style=for-the-badge&logo=github&logoColor=white">
<img title="Versão" src="https://img.shields.io/badge/Versão-2.0.0-orange?style=for-the-badge&logo=github&logoColor=white">
<img title="Node" src="https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=for-the-badge&logo=node.js&logoColor=white">
<img title="License" src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge">

<br><br>

<img title="whatsapp-web.js" src="https://img.shields.io/badge/whatsapp--web.js-1.34.7-25D366?style=for-the-badge&logo=whatsapp&logoColor=white">
<img title="SQLite" src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=for-the-badge&logo=sqlite&logoColor=white">
<img title="DragonBall" src="https://img.shields.io/badge/Tema-Dragon%20Ball-FF6600?style=for-the-badge">

</div>

---

## ✅ O que esta versão já tem

- 🔐 Registro de personagem por universo
- 🟢 Personagens livres, ocupados e bloqueados
- 🗝️ Código de resgate para personagens lendários/bloqueados
- 🗄️ Banco SQL local em SQLite
- 🛡️ Comandos de admin para Zenies, Ki, cargos e universos
- 👑 Sistema de cargos principais, cargos supremos e trabalhos secundários
- 💰 Salário automático a cada 2 dias
- 🏦 Depósito com juros de 25% a cada 4 dias
- 🛒 Loja com compra de Ki e itens especiais
- 🎒 Inventário SQL para guardar itens comprados
- 🎯 Sistema de eventos manuais com limite diário
- ❓ Perguntas de Dragon Ball com alternativas A, B, C e D
- 🔡 Forca de Dragon Ball
- ⚡ Eventos automáticos de emoji do dragão e pergunta relâmpago
- 🗑️ Remoção automática do personagem após 3 meses de inatividade
- 🪪 Perfil com foto, personagem, Ki, atributos totais, Zenies, depósito, cargo, trabalho e salário
- 🃏 Blackjack, Poker e Truco Paulista
- 🎰 Tigrinho com múltiplos símbolos e prêmios
- 💸 PIX entre jogadores com extrato financeiro

---

## 📦 Instalação

```bash
npm install
cp .env.example .env
npm start
```

> No primeiro start, escaneie o QR Code no terminal usando o WhatsApp.

---

## ⚙️ Configuração de Admins

Use no WhatsApp:

```
/meuid
```

O bot vai mostrar:

- Se você já está sendo reconhecido como admin
- Seu número limpo
- Seu JID/LID completo
- Os valores aceitos no `ADMIN_NUMBERS`

No `.env`, você pode usar número limpo, JID completo ou LID completo:

```env
ADMIN_NUMBERS=5567999999999
```

Em alguns grupos, o WhatsApp entrega o remetente como `@lid`. Se o número limpo não funcionar, coloque também o LID mostrado em `/meuid`:

```env
ADMIN_NUMBERS=5567999999999,123456789@lid
```

> ⚠️ Depois de alterar o `.env`, reinicie o bot.

> 💡 Admins do `.env` podem usar os comandos administrativos mesmo sem cargo dentro do RPG.

---

## 🕐 Fuso Horário

O bot usa o fuso horário para resetar limites diários de eventos:

```env
TIMEZONE=America/Campo_Grande
```

---

## 🎮 Comandos de Jogador

```
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
/menu
```

---

## 🛡️ Comandos Administrativos

```
/addzenies @pessoa 50000000
/retirarzenies @pessoa 50000000
/definirki @pessoa 5
/addcargo @pessoa A.S
/adduniverso 3
/codigoresgate Bardock          # válido em qualquer universo
/codigoresgate 2 Bardock        # válido somente no Universo 2
/codes desconto 50 5            # desconto só na próxima compra
/inspecionar CODIGO
/eventos ativar
/eventos desativar
```

---

## 🎯 Eventos

Use `/eventos` para ver a lista de eventos e o status diário do jogador.

### Eventos Manuais

| Info | Valor |
|---|---|
| Máximo por dia | 10 eventos |
| Recompensa por acerto | 10.000.000 Zenies |
| Máximo diário | 100.000.000 Zenies |

> Se errar, não ganha nada e o evento é encerrado.

### ❓ Perguntas e Respostas

```
/eventos pergunta
/responder A
```

O bot sorteia uma pergunta de Dragon Ball com alternativas A, B, C e D.

### 🔡 Forca

```
/eventos forca
/letra A
/chutar Kamehameha
```

O bot sorteia uma palavra de Dragon Ball. O jogador tem **6 erros** possíveis.

### ⚔️ Desafio Rápido

```
/eventos desafio
/responder B
```

O bot sorteia uma situação rápida do RPG para o jogador resolver.

### 🤖 Eventos Automáticos

```
/eventos ativar     # ativa no grupo atual (admin)
/eventos desativar  # desativa no grupo atual (admin)
```

#### 🐉 Pegue o Emoji

A cada hora, o bot pode mandar `🐉` no chat. O primeiro jogador que mandar `/pegar` ganha **5.000.000 Zenies**.
O bot envia no máximo **10 emojis por dia por chat**.

#### ⚡ Pergunta Relâmpago

Em 3 horários do dia (`10h`, `16h` e `21h`), o bot manda uma pergunta aleatória. O primeiro a responder corretamente com `/responder A` ganha **25.000.000 Zenies**.

---

## 🛒 Loja

Use `/loja` para ver a tabela de Ki e os itens disponíveis.

### Tabela de Ki

| Nível | Preço |
|---|---|
| Ki 01 | Grátis |
| Ki 02 | 750.000.000 Zenies |
| Ki 03 | 1.250.000.000 Zenies |
| Ki 04 | 1.600.000.000 Zenies |
| Ki 05 | 2.750.000.000 Zenies |
| Ki 06 | 3.500.000.000 Zenies |
| Ki 07 | 4.600.000.000 Zenies |
| Ki 08 | 5.000.000.000 Zenies |
| Ki 09 | 7.500.000.000 Zenies |
| Ki 10 | 10.000.000.000 Zenies |
| Ki 11+ | 10.000.000.000 Zenies por nível |

> Use `/comprar Ki` para comprar sempre o **próximo Ki** do seu personagem.

### Itens Especiais

| Item | Preço |
|---|---|
| Semente dos Deuses | 10.000.000.000 Zenies |
| Scouter | 350.000.000 Zenies |
| Nave Espacial | 3.500.000.000 Zenies |
| Cauda Saiyajin | 1.000.000.000 Zenies |
| Nuvem Voadora | 1.000.000.000 Zenies |

```
/comprar Scouter
/comprar Nave Espacial
/comprar Cauda Saiyajin
/comprar Nuvem Voadora
/comprar Semente dos Deuses
```

> Os itens comprados ficam salvos em `player_inventory`.

---

## 🎒 Inventário

```
/inventario
```

O bot mostra quantos itens o jogador possui.

---

## 👑 Cargos e Permissões

### Cargos Supremos

Estes cargos **não ocupam personagem comum** do universo. Entram na lista da Alta Cúpula.

| Sigla | Cargo |
|---|---|
| `A.S` | Autoridade Suprema |
| `S.M` | Supremo Ministro |
| `HAKAI` | Hakaishin |
| `ANJO` | Anjo |
| `G.K` | Grande Kaioshin |

> Apenas **Autoridade Suprema**, **Supremo Ministro** ou admins do `.env` podem adicionar cargos supremos.

> Hakaishin, Anjo e Grande Kaioshin podem adicionar cargos não supremos a jogadores do próprio universo.

### Cargos Principais

| Sigla | Cargo |
|---|---|
| `L.I` | Lutador Iniciante |
| `KAMI` | Kami-sama |
| `KAIOH` | Kaioh |
| `G.KAIOH` | Grande Kaioh |
| `KAIO` | Kaioshin |

### Trabalhos / Cargos Secundários

| Sigla | Cargo |
|---|---|
| `L.E` | Líder da Elaboração |
| `ELAB` | Elaborador |
| `J.O` | Juíz Oficial |
| `RANK` | Rankeador |
| `T.K` | Treinador (Kaioh) |
| `L.J` | Líder do Jornal |
| `JORNAL` | Jornalista |
| `SITE` | Atualizador do site |

---

## 💰 Salários

O salário cai automaticamente a cada **2 dias** quando o bot estiver rodando. O bot também verifica pagamentos pendentes ao iniciar.

> Se o jogador tiver um cargo principal e um trabalho secundário, o salário total é a **soma dos dois**.

---

## 🏦 Depósito

```
/depositar 50000000
```

O valor sai dos Zenies disponíveis e entra no depósito. A cada **4 dias**, o depósito gera **25% de juros** que vão direto para o saldo de Zenies.

---

## ⚡ Ki e Atributos

Todo jogador começa com **Ki 01** e **100.000.000 Zenies**.

Cada nível de Ki vale `+4.000.000` em atributos totais.

| Ki | Atributos Totais |
|---|---|
| Ki 01 | 4.000.000 |
| Ki 05 | 20.000.000 |
| Ki 10 | 40.000.000 |

---

## ⏳ Inatividade

Se uma conta ficar **3 meses** sem usar comandos do bot, o personagem é apagado automaticamente e volta a ficar livre.

---

## 🗄️ Banco de Dados

O SQLite é criado automaticamente em `data/dragonverse.sqlite`.

| Tabela | Descrição |
|---|---|
| `universes` | Universos cadastrados |
| `characters` | Personagens disponíveis |
| `players` | Jogadores registrados |
| `character_claims` | Vínculos jogador ↔ personagem |
| `rescue_codes` | Códigos de resgate |
| `player_inventory` | Inventário de itens |
| `purchase_history` | Histórico de compras |
| `event_daily_stats` | Status diário de eventos |
| `event_chats` | Chats com eventos ativos |
| `event_chat_daily_stats` | Estatísticas diárias por chat |
| `active_events` | Eventos em andamento |
| `transfer_history` | Histórico de transferências PIX |

---

## 🖼️ Fotos dos Personagens

Coloque imagens PNG na pasta:

```
assets/personagens/
```

O nome deve ser o **slug** do personagem:

```
assets/personagens/goku.png
assets/personagens/android-17.png
assets/personagens/broly-dbs.png
assets/personagens/dragao-de-uma-estrela.png
```

> Se a imagem não existir, o `/Perfil` envia apenas o texto e mostra o caminho esperado.

---

## 🔄 Atualização v7 — Personagens, Troca e Tigrinho

### Novidades do Universo 2

- Baby, Bibidi, Hit e Vegeta como **bloqueados**
- Broly (DBZ), Chaos e Mr. Popo **adicionados**
- Android 18, Gohan, Goku Black, Goten, Janemba, Kale, Kid Buu, Majin Buu, Piccolo, Towa e Trunks do Futuro começam **livres**

### Comandos de Personagem

```
/addpersonagem Nome do Personagem Block
/addpersonagem Nome do Personagem Free
/addpersonagem 3 Nome do Personagem Block
/rmvpersonagem Nome do Personagem
/rmvpersonagem 3 Nome do Personagem
/Trocarpersonagem Nome do Personagem
```

> `/Trocarpersonagem` só permite trocar para personagem livre do mesmo universo. Custa **25% dos Zenies** atuais.

### 🎰 Tigrinho

```
/tigrinho valorapostado
```

| Regra | Detalhe |
|---|---|
| Aposta mínima | 1.000.000 Zenies |
| Apostas por dia | 3 vezes |
| 3 🐉 | 2x a aposta |
| 6 🐉 | 5x a aposta |
| 9 🐉 | 10x a aposta |
| 3 ou mais 💩 | Perde o dobro |
| Sem combinação | Perde a aposta |

---

## 🔄 Atualização v8 — Transferência e Tigrinho Novo

### 💸 PIX DragonVerse

```
/pix @pessoa valor
/extrato
/extrato entrada
/extrato saida
/extrato perda
```

O bot desconta o valor de quem enviou, adiciona a quem recebeu e registra em `transfer_history`.

### 🎰 Tigrinho com Novos Símbolos

| Símbolo | 3 iguais | 6 iguais | 9 iguais |
|---|:---:|:---:|:---:|
| 🐉 Dragão | 2x | 5x | 10x |
| 🐯 Tigre | 3x | 7x | 15x |
| 🦍 Gorila | 4x | 8x | 20x |
| 💎 Diamante | 5x | 10x | 25x |
| ⭐ Estrela | 2x | 4x | 8x |
| 🔥 Fogo | 2x | 4x | 8x |
| 🍀 Trevo | 2x | 5x | 12x |
| 🪙 Moeda | 2x | 3x | 6x |

> Se mais de uma combinação sair, o bot paga a **melhor combinação**.

---

## 🔄 Atualização v9 — Alta Cúpula

Ao iniciar o bot, a migration sincroniza `character_claims.claim_type`:

- Jogadores com cargo supremo (`A.S`, `S.M`, `HAKAI`, `ANJO`, `G.K`) passam para `claim_type = 'supremo'`
- Personagens supremos continuam aparecendo no `/Perfil`
- Esses personagens **deixam de aparecer** como ocupados em `/Personagens universo`
- Não é necessário apagar `data/dragonverse.sqlite`

> Quando alguém recebe um cargo supremo via `/addcargo`, a vaga comum do universo é liberada imediatamente.

---

## 🔄 Atualização v10 — Menu, Pix e Jogos de Cartas

### Comandos Renomeados

| Antigo | Novo |
|---|---|
| `/help` | `/menu` |
| `/transferir` | `/pix` |

### 🃏 Blackjack

```
/blackjack iniciar 1000000
/blackjack carta
/blackjack parar
/blackjack dobrar
```

| Resultado | Pagamento |
|---|---|
| Vitória | 2x |
| Empate | Devolve a aposta |
| Blackjack Natural | 2.5x |

### ♠️ Poker (Texas Hold'em)

```
/poker criar 1000000
/poker entrar
/poker iniciar
/poker apostar 5000000
/poker allin
/poker mesa
/poker desistir
/poker cartas
```

O bot envia as cartas no privado, abre as comunitárias com `/poker mesa` e calcula o vencedor no showdown.

### 🎴 Truco Paulista

```
/truco criar valor
/truco entrar
/truco iniciar
/truco jogar 1
/3
/6
/9
/12
/aceitar
/recusar
/truco cartas
```

Baralho limpo (sem 8, 9, 10 e coringas). O bot envia as cartas no privado, mostra a vira e a manilha no grupo.

---

## 🔄 Atualização v16 — Regras, Mesas e Menções Clicáveis

### Regras dos Jogos

```
/regras poker
/regras blackjack
/regras truco
```

### Blackjack em Mesa de Grupo

```
/blackjack criar 1000000
/blackjack entrar
/blackjack start
/carta
/parar
```

Os jogadores entram, o bot marca quem está na vez, cada um pede carta até parar/estourar e no final a mesa joga e paga os vencedores.

### Truco com Apostas

Aceita **2 ou 4 jogadores**, sorteia duplas no 2v2, joga até um time chegar a **12 pontos**. Prêmio é o pote total:
- **1v1** → vai inteiro para o vencedor
- **2v2** → dividido entre a dupla vencedora

### Menções Clicáveis

Comandos de jogos de cartas, PIX, economia admin, cargo e eventos agora retornam `mentions` com JID real do WhatsApp, evitando o aviso `Contact deprecated` e permitindo **menção azul clicável**.

---

<div align="center">

<img src="https://img.shields.io/badge/Feito%20com-❤️%20para%20Dragon%20Ball-FF6600?style=for-the-badge">

</div>
