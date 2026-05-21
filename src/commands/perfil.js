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
        const ext = path.extname(finalPath).toLowerCase();
        const isGif = ext === '.gif';
        const isVideo = ext === '.mp4';

        // Monta o MessageMedia manualmente via base64 para evitar o erro t:t do puppeteer
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'video/mp4',   // GIF enviado como vídeo curto
            '.mp4': 'video/mp4',
        };

        const mime = mimeTypes[ext] || 'application/octet-stream';
        const fileBuffer = fs.readFileSync(finalPath);
        const base64 = fileBuffer.toString('base64');
        const media = new MessageMedia(mime, base64, path.basename(finalPath));

        const chat = await message.getChat();

        if (isGif || isVideo) {
            await chat.sendMessage(media, {
                caption,
                sendVideoAsGif: isGif,
            });
        } else {
            await message.reply(media, undefined, { caption });
        }
        return;
    }

    await message.reply(caption + '\n\n📷 Foto ou mídia não encontrada em: ' + basePath + '.*');
}

module.exports = { perfilCommand };
