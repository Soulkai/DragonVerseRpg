const db = require('../database/db');

function seedItems() {
    const items = [
        { id: 'capsula-comum', name: 'Cápsula da Corporação', slug: 'capsula-comum', type: 'capsule', rarity: 'C', bonus: 0.1, price: 250000000 },
        { id: 'selo-mafuba', name: 'Selo Mafuba', slug: 'selo-mafuba', type: 'capsule', rarity: 'S', bonus: 0.5, price: 2500000000 },
        { id: 'semente-dos-deuses', name: 'Semente dos Deuses', slug: 'semente-dos-deuses', type: 'item', rarity: 'S', bonus: 0, price: 4000000000 },
        { id: 'scouter', name: 'Scouter', slug: 'scouter', type: 'item', rarity: 'C', bonus: 0, price: 1400000000 },
        { id: 'nave-espacial', name: 'Nave Espacial', slug: 'nave-espacial', type: 'item', rarity: 'A', bonus: 0, price: 14000000000 },
        { id: 'cauda-saiyajin', name: 'Cauda Saiyajin', slug: 'cauda-saiyajin', type: 'item', rarity: 'A', bonus: 0, price: 4000000000 },
        { id: 'nuvem-voadora', name: 'Nuvem Voadora', slug: 'nuvem-voadora', type: 'item', rarity: 'A', bonus: 0, price: 4000000000 }
    ];

    const insert = db.prepare(`
        INSERT OR REPLACE INTO items_catalog (id, name, slug, type, rarity, capture_rate_bonus, price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items) => {
        for (const item of items) {
            insert.run(item.id, item.name, item.slug, item.type, item.rarity, item.bonus, item.price);
        }
    });

    transaction(items);
    console.log('✅ Loja populada com sucesso!');
}

module.exports = { seedItems };
