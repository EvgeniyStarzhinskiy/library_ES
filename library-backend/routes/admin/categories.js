// routes/admin/categories.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/init');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { rebuildCategoryPaths } = require('../../services/categoryPathService');

const checkApiKey = (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (key && key === process.env.API_KEY) return next();
    authenticateToken(req, res, () => requireAdmin(req, res, next));
};
router.use(checkApiKey);

router.post('/', (req, res) => {
    try {
        const db = getDB();
        const { name, parent_id, sort_order } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: true, message: 'Название категории обязательно' });
        }
        const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9а-яё-]/g, '').substring(0, 200);
        const result = db.prepare(
            'INSERT INTO categories (name, slug, parent_id, sort_order) VALUES (?, ?, ?, ?)'
        ).run(name, slug, parent_id || null, sort_order || 0);
        rebuildCategoryPaths();
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(category);
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

router.get('/', (req, res) => {
    try {
        const db = getDB();
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all();
        res.json({ data: categories });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

router.put('/:id', (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const { name, parent_id, sort_order } = req.body;
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!category) return res.status(404).json({ error: true, message: 'Категория не найдена' });
        if (parent_id && +parent_id === +id) {
            return res.status(400).json({ error: true, message: 'Нельзя сделать родителем себя' });
        }
        if (parent_id) {
            const descendants = db.prepare(
                'SELECT descendant_id FROM category_paths WHERE ancestor_id = ? AND depth > 0'
            ).all(id);
            if (descendants.some(d => +d.descendant_id === +parent_id)) {
                return res.status(400).json({ error: true, message: 'Нельзя переместить в подкатегорию' });
            }
        }
        const newName = name ?? category.name;
        const newParent = parent_id !== undefined ? parent_id : category.parent_id;
        const newOrder = sort_order !== undefined ? sort_order : category.sort_order;
        db.prepare('UPDATE categories SET name=?, parent_id=?, sort_order=? WHERE id=?')
            .run(newName, newParent, newOrder, id);
        rebuildCategoryPaths();
        const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!category) return res.status(404).json({ error: true, message: 'Категория не найдена' });
        const descendants = db.prepare(
            'SELECT descendant_id FROM category_paths WHERE ancestor_id = ?'
        ).all(id).map(r => r.descendant_id);
        const transaction = db.transaction(() => {
            const placeholders = descendants.map(() => '?').join(',');
            db.prepare(`DELETE FROM document_category WHERE category_id IN (${placeholders})`).run(...descendants);
            db.prepare('DELETE FROM category_paths WHERE descendant_id IN (SELECT descendant_id FROM category_paths WHERE ancestor_id = ?)').run(id);
            db.prepare('DELETE FROM category_paths WHERE ancestor_id = ?').run(id);
            db.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).run(...descendants);
        });
        transaction();
        rebuildCategoryPaths();
        res.json({ success: true, deleted: descendants.length });
    } catch (err) {
        res.status(500).json({ error: true, message: err.message });
    }
});

module.exports = router;