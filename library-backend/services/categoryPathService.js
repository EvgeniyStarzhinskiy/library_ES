// services/categoryPathService.js
const { getDB } = require('../db/init');

function rebuildCategoryPaths() {
    const db = getDB();
    db.transaction(() => {
        db.exec('DELETE FROM category_paths WHERE depth > 0');

        db.exec(`
            INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth)
            SELECT id, id, 0 FROM categories
        `);

        db.exec(`
            INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth)
            SELECT parent_id, id, 1 FROM categories WHERE parent_id IS NOT NULL
        `);

        let depth = 1;
        let inserted;
        do {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth)
                SELECT cp1.ancestor_id, cp2.descendant_id, ?
                FROM category_paths cp1
                JOIN category_paths cp2 ON cp1.descendant_id = cp2.ancestor_id
                WHERE cp1.depth = 1 AND cp2.depth = ?
            `);
            const result = stmt.run(depth + 1, depth);
            inserted = result.changes;
            depth++;
        } while (inserted > 0);
    })();
    console.log('✓ Дерево category_paths перестроено');
}

module.exports = { rebuildCategoryPaths };