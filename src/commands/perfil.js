const { MessageMedia } = require('whatsapp-web.js');
const { getProfile } = require('../services/personagemService');
const { profileCaption } = require('../utils/format');
const { getFirstMentionedId } = require('../utils/mentions');
const { isAdmin } = require('../utils/admin');

async function perfilCommand(message, command = {}) {
  let targetWhatsappId = null;
  const mentioned = getFirstMentionedId(message, command.argsText || '');

  if (mentioned) {
    const admin = await isAdmin(message);
    if (!admin) {
      await message.reply('Apenas administradores podem ver o perfil de outra pessoa com */perfil @pessoa*.');
      return;
    }
    targetWhatsappId = mentioned;
  }

  const result = getProfile(message, targetWhatsappId);
  if (!result.ok) {
    await message.reply(result.message);
    return;
  }

  const caption = profileCaption(result.profile);

  if (result.imagePath) {
    const media = MessageMedia.fromFilePath(result.imagePath);
    await message.reply(media, undefined, { caption });
    return;
  }

  await message.reply(caption + '\n\n📷 Foto não encontrada. Coloque a imagem em: ' + result.profile.image_path);
}

module.exports = { perfilCommand };
