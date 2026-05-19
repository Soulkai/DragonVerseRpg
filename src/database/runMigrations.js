const { migrate } = require('./migrate'); // Migração original
const { migrateV2 } = require('./migrations/v2_rpg_systems');

console.log('🚀 Iniciando todas as migrações do DragonVerse...');

try {
    // Roda a migração base
    migrate();
    
    // Roda os novos sistemas RPG
    migrateV2();

    console.log('✨ Banco de dados totalmente atualizado!');
    process.exit(0);
} catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
}
