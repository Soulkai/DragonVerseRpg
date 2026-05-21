const { MessageMedia } = require('whatsapp-web.js');
const { getProfile } = require('../services/personagemService');
const { profileCaption } = require('../utils/format');
const { getFirstMentionedId } = require('../utils/mentions');
const { isAdmin } = require('../utils/admin');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Usa o binário exato do ffmpeg-static, sem passar por fluent-ffmpeg
const ffmpegBin = require('ffmpeg-static');

function gifToMp4(gifPath) {
    return new Promise((resolve, reject) => {
        const output = path.join(os.tmpdir(), `gif_${Date.now()}.mp4`);

        const args = [
            '-y',                          // sobrescreve se existir
            '-i', gifPath,                 // input
            '-movflags', 'faststart',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-an',                         // sem áudio
            output
        ];

        const proc = spawn(ffmpegBin, args);

        proc.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`ffmpeg encerrou com código ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(new Error('Falha ao iniciar ffmpeg: ' + err.message));
        });
    });
}

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

        let sendPath = finalPath;
        let tempFile = null;

        if (isGif) {
            sendPath = await gifToMp4(finalPath);
            tempFile = sendPath;
        }

        const mimeMap = {
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.mp4':  'video/mp4',
        };

        const mime = (isGif || isVideo) ? 'video/mp4' : (mimeMap[ext] || 'image/png');
        const base64 = fs.readFileSync(sendPath).toString('base64');
        const media = new MessageMedia(mime, base64, path.basename(sendPath));
        const chat = await message.getChat();

        if (isGif || isVideo) {
            await chat.sendMessage(media, {
                caption,
                sendVideoAsGif: true,
            });
        } else {
            await message.reply(media, undefined, { caption });
        }

        if (tempFile && fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }

        return;
    }

    await message.reply(caption + '\n\n📷 Foto ou mídia não encontrada em: ' + basePath + '.*');
}

module.exports = { perfilCommand };
