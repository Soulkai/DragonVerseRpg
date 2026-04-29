async function helpCommand(message) {
  await message.reply([
    '🐉 *Comandos DragonVerse*',
    '',
    '*Jogador*',
    '*/Personagens 2* — Mostra personagens livres, ocupados e bloqueados.',
    '*/Registro 2 Goku* — Registra seu personagem.',
    '*/Registro 2 Bardock CÓDIGO* — Registra personagem bloqueado com código.',
    '*/Perfil* — Mostra seu perfil, Ki, atributos, Zenies, depósito, cargo e salário.',
    '*/depositar valor* — Deposita Zenies e gera 25% de juros a cada 4 dias.',
    '*/cargos* — Mostra os IDs dos cargos.',
    '',
    '*Admin / Alta Cúpula*',
    '*/addzenies @pessoa valor* — Adiciona Zenies.',
    '*/definirki @pessoa valor* — Define o nível de Ki.',
    '*/addcargo @pessoa ID* — Define cargo ou trabalho.',
    '*/adduniverso número* — Cria novo universo com lista limpa de personagens.',
    '*/codigoresgate 2 Bardock* — Gera código para personagem bloqueado.',
  ].join('\n'));
}

module.exports = { helpCommand };
