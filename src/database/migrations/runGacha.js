// Arquivo: src/database/runGacha.js
const { seedGacha } = require('./seedGacha');

console.log('========================================');
console.log('🚀 Iniciando script isolado de Gacha...');
console.log('========================================');

try {
    // Roda apenas a função de povoar os personagens
    seedGacha();
    
    console.log('✨ Script finalizado com sucesso!');
    process.exit(0); // Força o terminal a fechar com sucesso
} catch (error) {
    console.error('❌ ERRO FATAL AO RODAR GACHA:', error);
    process.exit(1);
}
