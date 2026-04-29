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

## Comandos de jogador

```txt
/Personagens 2
/Registro 2 Goku
/Registro 2 Bardock DBV-XXXXXX-XXXX
/Perfil
/depositar 50000000
/cargos
/help
```

## Comandos administrativos

```txt
/addzenies @pessoa 50000000
/definirki @pessoa 5
/addcargo @pessoa A.S
/adduniverso 3
/codigoresgate 2 Bardock
```

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
