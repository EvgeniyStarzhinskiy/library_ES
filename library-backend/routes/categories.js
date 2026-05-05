const express = require('express');
const { getDB } = require('../db/init');

const router = express.Router();

// Получить список всех категорий с количеством документов
router.get('/', (req, res) => {
  const db = getDB();
  const categories = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(DISTINCT dc2.document_id)
       FROM category_paths cp2
       JOIN document_category dc2 ON dc2.category_id = cp2.descendant_id
       WHERE cp2.ancestor_id = c.id
      ) as document_count
    FROM categories c
    ORDER BY c.sort_order, c.name
  `).all();
  res.json({ data: categories });
});

// Получить одну категорию по slug
router.get('/:slug', (req, res) => {
  const db = getDB();
  const category = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(DISTINCT dc2.document_id)
       FROM category_paths cp2
       JOIN document_category dc2 ON dc2.category_id = cp2.descendant_id
       WHERE cp2.ancestor_id = c.id
      ) as document_count
    FROM categories c
    WHERE c.slug = ?
  `).get(req.params.slug);

  if (!category) {
    return res.status(404).json({ error: true, message: 'Категория не найдена' });
  }

  // Подкатегории (прямые потомки, depth = 1) любых типов
  const children = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(DISTINCT dc2.document_id)
       FROM category_paths cp2
       JOIN document_category dc2 ON dc2.category_id = cp2.descendant_id
       WHERE cp2.ancestor_id = c.id
      ) as document_count
    FROM category_paths cp
    JOIN categories c ON cp.descendant_id = c.id
    WHERE cp.ancestor_id = ? AND cp.depth = 1
    ORDER BY c.sort_order, c.name
  `).all(category.id);

  // Документы: привязанные к этой категории и ко всем её потомкам
  const documents = db.prepare(`
    SELECT DISTINCT d.*
    FROM documents d
    JOIN document_category dc ON d.id = dc.document_id
    JOIN category_paths cp ON dc.category_id = cp.descendant_id
    WHERE cp.ancestor_id = ? AND (d.is_published IS NULL OR d.is_published = 1)
    ORDER BY d.created_at DESC
    LIMIT 100
  `).all(category.id);

  res.json({ ...category, children, documents });
});

// Дерево для осей навигации
router.get('/tree/:axis', (req, res) => {
  const db = getDB();
  const { axis } = req.params;

  let rootType;
  if (axis === 'type-first') rootType = 'equipment-type';
  else if (axis === 'manufacturer-first') rootType = 'manufacturer';
  else return res.status(400).json({ error: true, message: 'Неверная ось' });

  const childType = rootType === 'manufacturer' ? 'equipment-type' : 'manufacturer';

  // Получаем узлы первого уровня
  const roots = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(DISTINCT dc2.document_id)
       FROM category_paths cp2
       JOIN document_category dc2 ON dc2.category_id = cp2.descendant_id
       WHERE cp2.ancestor_id = c.id
      ) as document_count
    FROM categories c
    WHERE c.type = ?
    ORDER BY c.name
  `).all(rootType);

  // Для каждого корня получаем детей второго уровня
  const tree = roots.map(root => {
    const children = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(DISTINCT dc2.document_id)
         FROM category_paths cp2
         JOIN document_category dc2 ON dc2.category_id = cp2.descendant_id
         WHERE cp2.ancestor_id = c.id
        ) as document_count
      FROM category_paths cp
      JOIN categories c ON cp.descendant_id = c.id
      WHERE cp.ancestor_id = ? AND cp.depth = 1 AND c.type = ?
      ORDER BY c.name
    `).all(root.id, childType);

    // Для каждого ребёнка получаем модели (depth=2)
    const childrenWithModels = children.map(child => {
      const models = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(DISTINCT dc2.document_id)
           FROM category_paths cp2
           JOIN document_category dc2 ON dc2.category_id = cp2.descendant_id
           WHERE cp2.ancestor_id = c.id
          ) as document_count
        FROM category_paths cp
        JOIN categories c ON cp.descendant_id = c.id
        WHERE cp.ancestor_id = ? AND cp.depth = 1 AND c.type = 'model'
        ORDER BY c.name
      `).all(child.id);
      return { ...child, children: models };
    });

    return { ...root, children: childrenWithModels };
  });

  res.json({ axis, tree });
});

module.exports = router;