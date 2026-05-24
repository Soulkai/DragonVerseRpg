const cron = require('node-cron');
const { generateDailyBanners } = require('../services/gachaService');

/**
 * Agenda a geração do banner diário às 00:00 todo dia.
 * Adicione ao seu arquivo de inicialização do bot:
 *
 *   const { startGachaScheduler } = require('./services/gachaScheduler');
 *   startGachaScheduler();
 */
function startGachaScheduler() {
    // '0 0 * * *' = todos os dias às 00:00
    cron.schedule('0 0 * * *', () => {
        console.log('[scheduler] 00:00 — Gerando banners do dia...');
        try {
            generateDailyBanners();
            console.log('[scheduler] Banners gerados com sucesso!');
        } catch (err) {
            console.error('[scheduler] Erro ao gerar banners:', err);
        }
    }, {
        timezone: 'America/Sao_Paulo'
    });

    console.log('[scheduler] GachaScheduler ativo — banners serão gerados todos os dias às 00:00 (Brasília).');
}

module.exports = { startGachaScheduler };
