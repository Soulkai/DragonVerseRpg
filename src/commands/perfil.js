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
    
    // Lista de extensões suportadas para busca
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.webp'];
    let finalPath = null;

    // Remove a extensão .png padrão do service para testar todas as possibilidades
    const basePath = result.profile.image_path.replace(/\.png$/i, '');
    const absoluteBasePath = path.resolve(process.cwd(), basePath);

    // Varre as extensões para encontrar o arquivo existente
    for (const ext of extensions) {
        const candidate = absoluteBasePath + ext;
        if (fs.existsSync(candidate)) {
            finalPath = candidate;
            break;
        }
    }

    if (finalPath) {
        const media = MessageMedia.fromFilePath(finalPath);
        
        // Se for MP4 ou GIF, enviamos com suporte a vídeo/animação
        const isVideo = finalPath.endsWith('.mp4') || finalPath.endsWith('.gif');
        
        await message.reply(media, undefined, { 
            caption,
            sendVideoAsGif: finalPath.endsWith('.gif') 
        });
        return;
    }

    await message.reply(caption + '\n\n📷 Foto ou mídia não encontrada em: ' + basePath + '.*');
}

module.exports = { perfilCommand };
