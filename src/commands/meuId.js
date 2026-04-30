const { isAdmin, getSenderAdminCandidates } = require('../utils/admin');

function formatContactName(contact) {
  return contact?.pushname || contact?.name || contact?.shortName || 'Não identificado';
}

async function meuIdCommand(message) {
  const contact = await message.getContact();
  const senderId = message.author || message.from;
  const chatId = message.from;
  const contactId = contact?.id?._serialized || senderId;
  const contactUser = contact?.id?.user || String(senderId).split('@')[0];
  const contactServer = contact?.id?.server || String(senderId).split('@')[1] || 'desconhecido';
  const contactNumber = contact?.number || '';
  const cleanNumber = String(contactNumber || contactUser).replace(/\D/g, '');
  const adminCandidates = [...(await getSenderAdminCandidates(message))].filter(Boolean);
  const adminStatus = await isAdmin(message);

  const suggestedValues = [
    cleanNumber,
    contactId,
    senderId,
    contactNumber ? `${contactNumber}@c.us` : '',
  ]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);

  const lines = [
    '🪪 *Seu ID no WhatsApp*',
    '',
    `*Nome:* ${formatContactName(contact)}`,
    `*User:* ${contactUser}`,
    `*Número do contato:* ${contactNumber || 'não disponível'}`,
    `*Servidor:* ${contactServer}`,
    `*Reconhecido como admin agora:* ${adminStatus ? '✅ Sim' : '❌ Não'}`,
    '',
    '*JID/LID completo:*',
    `\`${contactId}\``,
    '',
    '*Número limpo para ADMIN_NUMBERS:*',
    `\`${cleanNumber || 'não disponível'}\``,
    '',
    '*Valores recomendados para colocar no ADMIN_NUMBERS:*',
    ...suggestedValues.map((value) => `\`${value}\``),
    '',
    '*IDs técnicos detectados pelo bot:*',
    ...adminCandidates.slice(0, 12).map((value) => `\`${value}\``),
    '',
    '*IDs técnicos da mensagem:*',
    `from: \`${message.from}\``,
    `author: \`${message.author || 'não existe em chat privado'}\``,
    `sender usado pelo bot: \`${senderId}\``,
    `chat atual: \`${chatId}\``,
    '',
    'Dica: se o número limpo não funcionar em grupo, coloque também o valor que termina com `@lid` ou o *JID/LID completo* no `ADMIN_NUMBERS`.',
    'Exemplos:',
    '`ADMIN_NUMBERS=5567999999999`',
    '`ADMIN_NUMBERS=5567999999999,123456789@lid`',
  ];

  await message.reply(lines.join('\n'));
}

module.exports = { meuIdCommand };
