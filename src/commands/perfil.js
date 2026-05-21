const { MessageMedia } = require('whatsapp-web.js');
const { getProfile } = require('../services/personagemService');
const { profileCaption } = require('../utils/format');
const { getFirstMentionedId } = require('../utils/mentions');
const { isAdmin } = require('../utils/admin');
const fs = require('fs');
const path = require('path');

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
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.webp'];
    let finalPath = null;

    const basePath = result.profile.image_path.replace(/\.png$/i, '');
    const absoluteBasePath = path.resolve(process.cwd(), basePath);

    for (const ext of extensions) {
        const candidate = absoluteBasePath + ext;
        if (fs.existsSync(candidate)) {
            finalPath = candidate;
            break;
        }
    }

    if (finalPath) {
        const media = MessageMedia.fromFilePath(finalPath);
        const chat = await message.getChat();
        const isGif = finalPath.endsWith('.gif');
        const isVideo = finalPath.endsWith('.mp4');

        await chat.sendMessage(media, {
            caption,
            sendVideoAsGif: isGif,
        });
        return;
    }

    await message.reply(caption + '\n\n📷 Foto ou mídia não encontrada em: ' + basePath + '.*');
}

module.exports = { perfilCommand };
