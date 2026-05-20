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

## 🔎 Sobre o projeto

DragonVerse é um bot de WhatsApp multi-device para **RPG de Dragon Ball**, com economia avançada, sistema de spawn/captura de guerreiros, raids, torneios, jogos de cartas e eventos automáticos, tudo persistido em **SQLite** com migrations e seeds próprios.

Arquitetura principal:

- `src/index.js` → entrypoint, anti-crash, roteamento de comandos e manutenção automática.
- `src/commands/` → camada de comandos (interface de texto com o jogador/admin).
- `src/services/` → regras de negócio (economia, eventos, ranked, torneios, shop, etc.).
- `src/systems/` → sistemas centrais (spawn/captura, raids, DVI/ricos).
- `src/data/` → dados estáticos (loja, cargos, eventos, lista de personagens).
- `src/database/` → SQLite, migrations, seeds de gacha e itens.
- `src/utils/` → utils de admin, formatos, menções, parse de comandos.

---

## ✅ Principais sistemas

- 🔐 **RPG de personagens**: registro por universo, lista de personagens livres/bloqueados, troca com custo em Zenies, cargos principais e supremos.
- 💰 **Economia completa**: Zenies, salários automáticos, depósito com juros, empréstimos, PIX entre jogadores, extrato detalhado, mercado paralelo (Z-Market / mercado negro).
- 🐲 **Spawn & Captura de Guerreiros**:
  - A cada 25 mensagens em grupos com eventos ativos, há 50% de chance de um guerreiro selvagem aparecer.
  - O guerreiro fica disponível por 10 minutos com nome, raridade e elemento.
  - Jogadores tentam capturar usando itens de captura (Cápsula da Corporação ou Selo Mafuba).
  - Selo Mafuba dá bônus de captura; em caso de sucesso, o personagem entra na coleção do jogador.
- 🎯 **Eventos de RPG**: perguntas, forca, desafio rápido, emoji do dragão, pergunta relâmpago, limite diário por jogador/chat, ranking de eventos e presença.
- 🧩 **Minigames e jogos de cartas**: Blackjack, Poker (Texas Hold’em), Truco paulista limpo, Tigrinho/slots com vários símbolos e multiplicadores.
- 🏆 **Ranked, torneios e raids**: partidas ranqueadas com ranking, torneios gerados pelo bot e sistema de raids automatizadas.
- 🎯 **Bounty & recompensas**: sistema de caça à cabeça, recompensas configuráveis, streak de atividade e reward service.
- 📡 **Integrações extras**: comandos de anime, busca/preview no Spotify, convites, menções clicáveis com JID real.

---

## 📦 Instalação

```bash
npm install
cp .env.example .env
npm start
```

> No primeiro start, escaneie o QR Code no terminal usando o WhatsApp.

---

## ⚙️ Configuração básica

### Admins

Use no WhatsApp:

```txt
/meuid
```

O bot mostra:

- Se você já está sendo reconhecido como admin
- Seu número limpo
- Seu JID/LID completo
- Os formatos aceitos em `ADMIN_NUMBERS`

No `.env`, você pode usar número limpo, JID completo ou LID completo:

```env
ADMIN_NUMBERS=5567999999999
ADMIN_NUMBERS=5567999999999,123456789@lid
```

> Depois de alterar o `.env`, reinicie o bot.

> Admins do `.env` podem usar comandos administrativos mesmo sem cargo dentro do RPG.

### Fuso horário

O bot usa o fuso horário para resetar limites diários de eventos e alguns agendamentos:

```env
TIMEZONE=America/Campo_Grande
```

---

## 👤 Comandos de jogador (core RPG)

```txt
/Personagens 2                 # lista de personagens do universo
/Registro 2 Goku              # registra um personagem
/Registro 2 Bardock DBV-XXXXXX-XXXX
/Perfil                       # mostra perfil completo
/cargos                       # lista seus cargos
/viagem                        # comandos de viagem/link entre chats
```

Inventário e loja:

```txt
/loja
/comprar Ki
/comprar Scouter
/comprar Semente dos Deuses
/inventario
```

Coleção de guerreiros capturados:

```txt
/box                           # mostra os personagens que você já capturou
```

---

## 🛡️ Comandos administrativos (RPG)

```txt
/adduniverso 3
/addpersonagem Nome Block
/addpersonagem Nome Free
/addpersonagem 3 Nome Block
/rmvpersonagem Nome
/rmvpersonagem 3 Nome
/Trocarpersonagem Nome        # troca para personagem livre (25% dos Zenies)
/addcargo @pessoa A.S
/players                      # lista jogadores
/deleteplayer @pessoa         # remove player do sistema
```

Cargos supremos e liderança de universo são respeitados conforme tabela de cargos (ver seção específica abaixo).

---

## 💰 Economia, PIX, empréstimos e mercados

Comandos de jogador:

```txt
/depositar 50000000
/saldo
/poupanca
/retirarpoupanca 10000000
/pix @pessoa 50000000
/extrato
/extrato entrada
/extrato saida
/extrato perda
/emprestimo 1000000000
```

Comandos de admin de economia:

```txt
/addzenies @pessoa 50000000
/retirarzenies @pessoa 50000000
/definirki @pessoa 5
```

Mercados especiais:

```txt
/zmarket         # Z-Market, loja especial
/zbuy Scouter    # compra no Z-Market
/mercadonegro    # mercado paralelo
```

A economia é persistida com ledger (`transfer_history`), juros de depósito a cada 4 dias e salários a cada 2 dias.

---

## 🐲 Sistema de spawn e captura

Fluxo básico:

1. Em grupos com eventos ativados (`/eventos ativar`), o bot conta mensagens por chat.
2. A cada **25 mensagens**, ele faz um sorteio com **50% de chance** de spawnar um guerreiro.
3. Se spawnar, o guerreiro fica disponível por **10 minutos** com nome, raridade e elemento.
4. Durante esse tempo, os jogadores podem tentar capturar:

```txt
/capturar
```

Regras de captura:

- É necessário ter itens de captura no inventário (`player_inventory`):
  - **Cápsula da Corporação**
  - **Selo Mafuba** (dá bônus na chance de captura)
- A chance base depende da raridade (C, U, R, S, SS, SSS, UR, LR, Godly).
- Em caso de sucesso, o personagem vai para a sua coleção (`player_collection`).
- Em caso de falha, o guerreiro **continua** spawnado até expirar o tempo.

Use `/box` para ver os guerreiros que você já capturou.

---

## 🎯 Eventos (manual e automático)

Use `/eventos` para ver a lista de eventos e o status diário do jogador.

### Eventos manuais

| Info | Valor |
|---|---|
| Máximo por dia | 10 eventos |
| Recompensa por acerto | 10.000.000 Zenies |
| Máximo diário | 100.000.000 Zenies |

```txt
/eventos
/eventos pergunta
/eventos forca
/eventos desafio
/responder A
/letra A
/chutar Kamehameha
/presenca
/rankeventos
```

### Eventos automáticos

```txt
/eventos ativar
/eventos desativar
```

- 🐉 **Emoji do dragão**: a cada hora pode surgir um `🐉` no chat; o primeiro a `/pegar` ganha Zenies.
- ⚡ **Pergunta relâmpago**: em horários pré-definidos, o bot envia uma pergunta rápida; o primeiro a responder ganha bônus.

Stats diárias por player e por chat são controladas via `event_daily_stats` e `event_chat_daily_stats`.

---

## 🃏 Jogos de cartas e Tigrinho

### Blackjack

```txt
/blackjack iniciar 1000000
/blackjack carta
/blackjack parar
/blackjack dobrar
```

- Jogado contra a mesa.
- Vitória paga 2x, empate devolve aposta, Blackjack natural paga 2.5x.

Também existe o modo **mesa de grupo**:

```txt
/blackjack criar 1000000
/blackjack entrar
/blackjack start
/carta
/parar
```

### Poker (Texas Hold’em simplificado)

```txt
/poker criar 1000000
/poker entrar
/poker iniciar
/poker apostar 5000000
/poker allin
/poker mesa
/poker desistir
/poker cartas
```

O bot envia cartas no privado, abre as comunitárias no grupo e calcula o vencedor.

### Truco paulista limpo

```txt
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

- Baralho limpo (sem 8, 9, 10 e coringas).
- Há modo com aposta, inclusive 2x2 com sorteio de duplas.

### Tigrinho / Cassino

```txt
/tigrinho valor
```

- Aposta mínima: `1.000.000` Zenies.
- Até 3 apostas por dia por jogador.
- Múltiplos símbolos (Dragão, Tigre, Gorila, Diamante, Estrela, Fogo, Trevo, Moeda) com multiplicadores diferentes.
- 3 ou mais 💩 fazem perder o dobro; se houver mais de uma combinação, o bot paga a melhor.

---

## 🏆 Ranked, torneios, raids e bounty

### Ranked (1x1)

```txt
/rankeada
/listarank
/irank
/desafio @alguem
/adesafio
/rdesafio
/rv @vencedor
/removerrank @jogador
```

- O `rankedService` cuida da criação e resultado das partidas.
- Ranking consultável via `/listarank` e `/irank`.

### Torneios

```txt
/gerartorneio 1000000
/inscrever
/torneio
/vencedor @pessoa
```

- `tournamentService` organiza chaves, eliminações e prêmios.

### Raids

```txt
/raid
/raids
```

- `systems/raids.js` gera raids automaticamente via manutenção (`checkAndGenerateRaids`).
- Jogadores podem entrar e enfrentar bosses cooperativamente.

### Bounty (caça à cabeça)

```txt
/cacacabeca
/caca cabeca
/vitoria @pessoa
```

- `bountyService` registra alvos, progressos e recompensas.

### DVI (Forbes dos ricos)

```txt
/dvi
/forbes
/ricos
/topricos
```

- `systems/dvi.js` monta um ranking de riqueza dos jogadores.

---

## 👑 Cargos e permissões

### Cargos supremos (Alta Cúpula)

Estes cargos **não ocupam personagem comum** do universo; aparecem no perfil, mas a vaga do universo continua livre.

| Sigla | Cargo |
|---|---|
| `A.S` | Autoridade Suprema |
| `S.M` | Supremo Ministro |
| `HAKAI` | Hakaishin |
| `ANJO` | Anjo |
| `G.K` | Grande Kaioshin |

- Apenas A.S, S.M ou admins do `.env` podem dar/remover cargos supremos.
- Ao receber cargo supremo, a claim comum é migrada para `claim_type = 'supremo'` e a vaga comum é liberada.

### Cargos principais

| Sigla | Cargo |
|---|---|
| `L.I` | Lutador Iniciante |
| `KAMI` | Kami-sama |
| `KAIOH` | Kaioh |
| `G.KAIOH` | Grande Kaioh |
| `KAIO` | Kaioshin |

### Trabalhos / cargos secundários

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

Salário total = salário do cargo principal + salário do cargo secundário (se houver).

---

## 🏦 Depósito e juros

```txt
/depositar 50000000
/saldo
/poupanca
/retirarpoupanca 10000000
```

- Depósito gera **25% de juros** a cada 4 dias, enquanto o bot estiver rodando.
- O serviço de economia verifica pagamentos pendentes ao iniciar.

---

## ⚡ Ki, atributos e progressão

- Todo jogador começa com **Ki 01** e **100.000.000** Zenies.
- Cada nível de Ki vale `+4.000.000` em atributos totais.

| Ki | Atributos totais |
|---|---|
| Ki 01 | 4.000.000 |
| Ki 05 | 20.000.000 |
| Ki 10 | 40.000.000 |

Compra de Ki:

```txt
/comprar Ki
```

O comando compra sempre o **próximo Ki** do jogador, respeitando os preços configurados em `data/shop.js`.

---

## ⏳ Inatividade

- Se uma conta ficar **3 meses** sem usar comandos, o personagem é apagado automaticamente e volta a ficar livre.
- `inactivityService` roda periodicamente para limpar claims inativas.

---

## 🗄️ Banco de dados e seeds

O SQLite é criado automaticamente em:

```txt
data/dragonverse.sqlite
```

Principais tabelas:

- `universes`, `characters`, `players`, `character_claims`, `rescue_codes`
- `player_inventory`, `purchase_history`
- `event_daily_stats`, `event_chats`, `event_chat_daily_stats`, `active_events`
- `transfer_history` (PIX, compras, perdas, ganhos)
- Tabelas auxiliares de ranked, torneios, raids e gacha

Seeds/scripts úteis:

- `database/seedGacha.js` → popula pools de gacha.
- `database/seedItems.js` → popula itens da loja.
- `database/runGacha.js` → utilitário para testar o sistema de spawn/captura via CLI.
- `database/runMigrations.js` → executa migrations de schema.

---

## 🖼️ Fotos dos personagens

Coloque imagens PNG na pasta:

```txt
assets/personagens/
```

Use o slug do personagem como nome do arquivo:

```txt
assets/personagens/goku.png
assets/personagens/android-17.png
assets/personagens/broly-dbs.png
assets/personagens/dragao-de-uma-estrela.png
```

Se a imagem não existir, o comando `/Perfil` envia apenas o texto e mostra o caminho esperado.

---

## 🧩 Extras e utilidades

- `/meuid` → mostra ID, JID, LID e se você é admin.
- `/convite` → gerenciamento de convites e links.
- `/anime`, `/animeep` → comandos temáticos de anime.
- `/spotify`, `/spotify2` → busca e interação com Spotify.
- Menções azuis clicáveis (JID real) em respostas de economia, jogos, PIX, cargos, eventos.

---

<div align="center">

<img src="https://img.shields.io/badge/Feito%20com-❤️%20para%20Dragon%20Ball-FF6600?style=for-the-badge">

</div>
