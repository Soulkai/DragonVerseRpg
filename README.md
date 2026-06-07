# DragonVerse RPG Bot

Bot de RPG Dragon Ball para WhatsApp feito em **Node.js**, **whatsapp-web.js** e **SQLite**. O projeto reúne personagens por universo, cargos, economia, poupança, PIX, loja, eventos, tigrinho, caixas, rankeada, torneios, blackjack, poker, truco/Ltruco, códigos de resgate, extrato, convite/recrutamento, caça-cabeça, gacha, raids e controle de permissões.

> Versão atual do pacote: **2.1.0**

## Cuidados importantes com o banco

O banco padrão fica em `./data/dragonverse.sqlite`. As migrações foram ajustadas para serem **compatíveis com dados antigos** e não recriar tabelas de produção à força.

Antes de atualizar um bot em uso, faça backup destes arquivos, se existirem:

```bash
cp data/dragonverse.sqlite data/dragonverse.sqlite.bak
cp data/dragonverse.sqlite-wal data/dragonverse.sqlite-wal.bak 2>/dev/null || true
cp data/dragonverse.sqlite-shm data/dragonverse.sqlite-shm.bak 2>/dev/null || true
```

No Windows, copie esses arquivos manualmente pela pasta `data/` antes de rodar a nova versão.

## Requisitos

- Node.js **18 ou superior**.
- Chrome ou Chromium instalado para o `whatsapp-web.js`.
- Uma conta de WhatsApp para escanear o QR Code.
- Permissão de escrita na pasta do projeto, principalmente em `data/` e `.wwebjs_auth/`.

## Instalação

```bash
npm install
copy .env.example .env   # Windows
# ou: cp .env.example .env   # Linux/macOS
npm run migrate
npm start
```

Na primeira execução, escaneie o QR Code exibido no terminal. A sessão fica salva em `.wwebjs_auth/`.

## Configuração `.env`

Use `.env.example` como base. Principais variáveis:

| Variável | Uso |
| --- | --- |
| `BOT_PREFIX` | Prefixo principal exibido nos menus. |
| `BOT_PREFIXES` | Prefixos aceitos, separados por vírgula. Ex.: `/,!,.` |
| `DB_PATH` | Caminho do SQLite. Padrão: `./data/dragonverse.sqlite`. |
| `DEFAULT_UNIVERSE` | Universo padrão para comandos que precisam de fallback. |
| `TIMEZONE` | Fuso usado por eventos e scheduler do gacha. |
| `ADMIN_NUMBERS` | Lista de admins quando o comando/serviço usa essa verificação. |
| `CHROME_EXECUTABLE_PATH` | Caminho manual do Chrome, se necessário. |
| `PUPPETEER_HEADLESS` | Use `false` para abrir janela do navegador em debug. |

Não publique `.env`, banco de dados real nem `.wwebjs_auth/`.

## Scripts

```bash
npm start            # inicia o bot
npm run dev          # inicia com --watch
npm run migrate      # cria/atualiza tabelas e seeds sem apagar dados antigos
npm run seed:gacha   # valida catálogo base do gacha clássico
npm run seed:gacha:v3# valida schema + seed do gacha V3
npm run check        # checa sintaxe de todos os arquivos JS em src/
```

## Estrutura principal

```text
src/
  commands/     comandos do WhatsApp
  services/     regras de economia, eventos, gacha, viagens, etc.
  systems/      sistemas maiores, como gacha de spawn e raids
  database/     conexão SQLite, migrações e seeds
  data/         catálogos estáticos de personagens, loja, cargos e eventos
  utils/        helpers de texto, menções, números, replies e admin
```

## Comandos comuns

Os exemplos usam `/`, mas o bot aceita os prefixos definidos em `BOT_PREFIXES`.

### Registro e perfil

```text
/personagens 2
/registro 2 nome-do-personagem
/perfil
/trocarpersonagem nome-do-personagem
/meuid
```

### Economia

```text
/saldo
/depositar 1000000
/retirarpoupanca 1000000
/pix @jogador 1000000
/transferir @jogador 1000000
/extrato
/loja
/comprar ki
/inventario
/emprestimo status
```

### Gacha, box e raids

```text
/gacha
/banner
/girar comum
/girar10 premium
/pullhistory
/up goku-crianca
/box
/capturar
/raids
/raid atacar goku-crianca
/mercado
```

### Eventos e jogos

```text
/eventos
/responder A
/letra A
/chutar palavra
/pegar
/presenca
/tigrinho 1000000
/blackjack criar 1000000
/poker criar 1000000
/truco
/ltruco
/caixa abrir 10kk
```

### Torneios, ranked e sociais

```text
/rankeada
/desafio @jogador
/adesafio
/rdesafio
/gerartorneio nome 1000000
/inscrever
/torneio
/convite gerar
/convite usar CODIGO
/cacacabeca
```

## Migrações e compatibilidade

A inicialização do bot chama `migrate()` automaticamente. Também é seguro rodar manualmente:

```bash
npm run migrate
```

As migrações atuais fazem validações idempotentes, adicionam colunas ausentes e preservam registros antigos. Foram incluídos ajustes para:

- `universe_links` antigo com `group_id` ou sem chave primária.
- `travels` antigo sem `origin_chat_id` e `destination_chat_id`.
- `player_inventory` antigo com `item_id` numérico e FK rígida para catálogo.
- `raid_bosses` antigo usando apenas `expires_at`.
- `character_claims` antigo sem `claim_type`.
- Tabelas do RPG V2/V3, gacha, raids e seeds carregadas no fluxo normal de inicialização.

## Solução de problemas

**Erro do `better-sqlite3` ao instalar:** confirme Node.js 18+ e reinstale dependências. Em Windows, instalar as ferramentas de build do Visual Studio pode ser necessário em algumas máquinas.

**QR Code não aparece ou navegador não abre:** defina `CHROME_EXECUTABLE_PATH` no `.env` apontando para o Chrome/Chromium instalado. Para debug visual, use `PUPPETEER_HEADLESS=false`.

**Banco travado (`database is locked`):** feche outras instâncias do bot usando o mesmo `DB_PATH`. Evite abrir o SQLite em editores que mantenham transações presas.

**Comando não responde:** confira se o prefixo está em `BOT_PREFIXES`, se o bot está no grupo correto e se o usuário possui cadastro quando o comando exige jogador.

## Alterações relevantes da 2.1.0

- Migrações destrutivas removidas ou convertidas em reconstruções preservando dados.
- RPG V2/V3, gacha, itens e seeds agora entram no fluxo normal de `migrate()`.
- Correções de compatibilidade para inventário, raids, viagens, links de universo e claims.
- Gacha respeita prefixos configurados, valida banner inválido e aplica desconto do `girar10` antes da cobrança.
- Scheduler do gacha usa `TIMEZONE` do `.env`.
- Puppeteer não força mais caminho fixo do Chrome no Windows; `CHROME_EXECUTABLE_PATH` é opcional.
- `npm run check` agora valida todos os arquivos JS em `src/`.
