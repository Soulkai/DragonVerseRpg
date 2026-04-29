const { MessageMedia } = require('whatsapp-web.js');
const { getProfile } = require('../services/personagemService');
const { profileCaption } = require('../utils/format');

async function perfilCommand(message) {
  const result = getProfile(message);
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
