const db = require('../database/db');

// Tabela de valores base para cada personagem capturado (em Zenies)
const RARITY_BASE_VALUE = {
    'C': 1_000_000,          // 1 Milhão
    'U': 5_000_000,          // 5 Milhões
    'R': 20_000_000,         // 20 Milhões
    'S': 100_000_000,        // 100 Milhões
    'SS': 500_000_000,       // 500 Milhões
    'SSS': 1_000_000_000,    // 1 Bilhão
    'UR': 2_500_000_000,     // 2.5 Bilhões
    'LR': 5_000_000_000,     // 5 Bilhões
    'Godly': 15_000_000_000  // 15 Bilhões!
};

// Calcula e atualiza o DVI de um jogador
function updatePlayerDVI(playerId) {
    // 1. Pega os dados brutos de economia do jogador
    const playerDb = db.prepare('SELECT zenies, deposito FROM players WHERE id = ?').get(playerId);
    if (!playerDb) return;

    // 2. Calcula o Total Gasto (Money Sink) lendo o banco de transações (se existir)
    // Caso você não tenha uma tabela que soma gastos totais ainda, podemos usar um valor estimado ou fixo
    // Vou assumir que você tem um registro de compras (ou vamos deixar 0 por enquanto)
    let totalSpent = 0;
    try {
        const spentQuery = db.prepare("SELECT SUM(amount) as total FROM ledger WHERE player_id = ? AND direction = 'saida'").get(playerId);
        totalSpent = spentQuery && spentQuery.total ? spentQuery.total : 0;
    } catch (e) {
        // Se a tabela ledger não existir no seu formato atual, ignora suavemente
    }

    // 3. Calcula o Valor da Coleção (Soma de todos os personagens + Duplicatas)
    const myChars = db.prepare(`
        SELECT c.rarity, pc.duplicates 
        FROM player_collection pc
        JOIN character_catalog c ON pc.character_id = c.id
        WHERE pc.player_id = ?
    `).all(playerId);

    let collectionValue = 0;
    myChars.forEach(char => {
        const baseValue = RARITY_BASE_VALUE[char.rarity] || 0;
        const totalAmount = 1 + (char.duplicates || 0);
        // Cada duplicata adiciona metade do valor base ao patrimônio (desvalorização por excesso)
        collectionValue += baseValue + (baseValue * 0.5 * (totalAmount - 1));
    });

    // 4. Calcula Contribuição Total em Raids
    const raidQuery = db.prepare('SELECT SUM(damage_dealt) as total_dmg FROM raid_logs WHERE player_id = ?').get(playerId);
    const raidContribution = raidQuery && raidQuery.total_dmg ? raidQuery.total_dmg : 0;

    // 5. A Fórmula Mestra do DVI
    const zeniesLiquidos = Number(playerDb.zenies || 0);
    const poupanca = Number(playerDb.deposito || 0);
    
    // O Score final que determina quem é o mais foda do RPG
    const dviScore = zeniesLiquidos + (poupanca * 1.2) + (totalSpent * 0.3) + collectionValue + (raidContribution * 0.1);

    // 6. Salva na tabela ranked_dvi
    db.prepare(`
        INSERT INTO ranked_dvi (player_id, zenies_liquid, savings_bank, collection_value, total_spent, raid_contribution_score, dvi_score, last_calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(player_id) DO UPDATE SET
            zenies_liquid = excluded.zenies_liquid,
            savings_bank = excluded.savings_bank,
            collection_value = excluded.collection_value,
            total_spent = excluded.total_spent,
            raid_contribution_score = excluded.raid_contribution_score,
            dvi_score = excluded.dvi_score,
            last_calculated_at = CURRENT_TIMESTAMP
    `).run(playerId, zeniesLiquidos, poupanca, collectionValue, totalSpent, raidContribution, dviScore);

    return dviScore;
}

// Roda isso para todo mundo de vez em quando para atualizar o ranking global
function updateAllPlayersDVI() {
    const players = db.prepare('SELECT id FROM players').all();
    players.forEach(p => updatePlayerDVI(p.id));
}

module.exports = { updatePlayerDVI, updateAllPlayersDVI };
