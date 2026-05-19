const { migrate } = require('./migrate'); // Migração original
const { migrateV2 } = require('./migrations/v2_rpg_systems');

// 1. Importa a função que insere os 300 personagens
const { seedGacha } = require('./seedGacha'); 

console.log('🚀 Iniciando todas as migrações do DragonVerse...');

try {
    // Roda a migração base
    migrate();
    
    // Roda os novos sistemas RPG (Isso cria a tabela character_catalog)
    migrateV2();

    // 2. Executa o povoamento do Gacha (Insere os personagens na tabela)
    seedGacha();

    console.log('✨ Banco de dados totalmente atualizado e personagens inseridos!');
    process.exit(0);
} catch (error) {
    console.error('❌ Erro durante a migração:', error);
    process.exit(1);
}
