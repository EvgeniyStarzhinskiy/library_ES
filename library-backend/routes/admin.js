const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getDB } = require('../db/init');
const { uploadToCloud } = require('../services/cloudStorage');

const router = express.Router();

// Настройка multer для временного хранения
const uploadDir = path.join(__dirname, '..', 'temp_uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_.-]/g, '_');
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + safeName;
    cb(null, uniqueName);
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.djvu', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.mp4', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат файла'));
    }
  }
});

// Middleware для проверки API-ключа или JWT
const checkApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key && key === process.env.API_KEY) {
    return next();
  }
  authenticateToken(req, res, () => {
    requireAdmin(req, res, next);
  });
};

router.use(checkApiKey);

// ==================== ДОКУМЕНТЫ ====================

// Получить список всех документов
router.get('/documents', (req, res) => {
  try {
    const db = getDB();
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const documents = db.prepare(`
      SELECT d.*, u.display_name as uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `).all(Number(limit), offset);
    
    const total = db.prepare('SELECT COUNT(*) as count FROM documents').get();
    
    res.json({ data: documents, total: total.count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Получить один документ для редактирования
router.get('/documents/:id', (req, res) => {
  try {
    const db = getDB();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: true, message: 'Не найден' });
    
    const tags = db.prepare(`
      SELECT t.* FROM tags t
      JOIN document_tag dt ON t.id = dt.tag_id
      WHERE dt.document_id = ?
    `).all(req.params.id);
    
    const categories = db.prepare(`
      SELECT c.* FROM categories c
      JOIN document_category dc ON c.id = dc.category_id
      WHERE dc.document_id = ?
    `).all(req.params.id);
    
    res.json({ ...doc, tags, categories });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Загрузка документа с файлом
router.post('/documents/upload', upload.single('file'), async (req, res) => {
  try {
    const db = getDB();
    const { title, author, year, theme, publisher, pages, description, category_ids, tag_ids } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: true, message: 'Файл не выбран' });
    }

    const fileExt = path.extname(file.originalname).replace('.', '').toLowerCase();
    const cloudPath = await uploadToCloud(file.path, 'Documents', file.filename);
    
    const docTitle = title || path.parse(file.originalname).name;

    const result = db.prepare(`
      INSERT INTO documents (title, author, year, theme, publisher, pages, description, file_type, cloud_path, file_size, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docTitle,
      author || null,
      year ? parseInt(year) : null,
      theme || null,
      publisher || null,
      pages ? parseInt(pages) : null,
      description || null,
      fileExt,
      cloudPath,
      file.size,
      req.user?.id || 1
    );

    const documentId = result.lastInsertRowid;

    // Привязка категорий
    if (category_ids) {
      const catIds = typeof category_ids === 'string' ? JSON.parse(category_ids) : category_ids;
      const insertCat = db.prepare('INSERT OR IGNORE INTO document_category (document_id, category_id) VALUES (?, ?)');
      for (const catId of catIds) {
        insertCat.run(documentId, catId);
      }
    }

    // Привязка тегов
    if (tag_ids) {
      const tagIds = typeof tag_ids === 'string' ? JSON.parse(tag_ids) : tag_ids;
      const insertTag = db.prepare('INSERT OR IGNORE INTO document_tag (document_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) {
        insertTag.run(documentId, tagId);
      }
    }

    // Удаляем временный файл
    fs.unlink(file.path, () => {});

    res.json({ id: documentId, message: 'Документ загружен', cloud_path: cloudPath });
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: true, message: err.message });
  }
});

// Обновить метаданные документа
router.patch('/documents/:id', (req, res) => {
  try {
    const db = getDB();
    const { 
      title, author, year, theme, publisher, pages, description, 
      is_published, cloud_path, file_type, preview_cloud_path 
    } = req.body;
    
    db.prepare(`
      UPDATE documents 
      SET 
        title = COALESCE(?, title),
        author = COALESCE(?, author),
        year = COALESCE(?, year),
        theme = COALESCE(?, theme),
        publisher = COALESCE(?, publisher),
        pages = COALESCE(?, pages),
        description = COALESCE(?, description),
        is_published = COALESCE(?, is_published),
        cloud_path = COALESCE(?, cloud_path),
        file_type = COALESCE(?, file_type),
        preview_cloud_path = COALESCE(?, preview_cloud_path),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title, author, year, theme, publisher, pages, description, 
      is_published, cloud_path, file_type, preview_cloud_path,
      req.params.id
    );

    res.json({ message: 'Документ обновлён' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});


router.delete('/documents/:id', (req, res) => {
  try {
    const db = getDB();
    const docId = req.params.id;

    // Удаляем связанные записи во всех зависимых таблицах
    db.prepare('DELETE FROM document_category WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM document_tag WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM ratings WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM favorites WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM comments WHERE document_id = ?').run(docId);

    // Удаляем сам документ
    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);

    res.json({ message: 'Документ удалён' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Создание документа без файла (только метаданные, для импорта)
router.post('/documents', (req, res) => {
  const db = getDB();
  const { title, author, year, theme, publisher, pages, description, file_type, cloud_path, source_path, sha256_hash } = req.body;

  if (!title) return res.status(400).json({ error: true, message: 'title обязателен' });

  // Проверка дубликата по source_path (если указан)
  if (source_path) {
    const existing = db.prepare('SELECT id FROM documents WHERE source_path = ?').get(source_path);
    if (existing) return res.status(409).json({ id: existing.id, existed: true, message: 'Документ уже существует' });
  }

  // Используем пользователя из API-ключа (или дефолтного админа)
  const userId = req.user?.id || 1;

  const result = db.prepare(`
    INSERT INTO documents (title, author, year, theme, publisher, pages, description, file_type, cloud_path, source_path, sha256_hash, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, author || null, year || null, theme || null, publisher || null, pages || null,
    description || null, file_type || 'pdf', cloud_path || '', source_path || null, sha256_hash || null, userId
  );

  res.json({ id: result.lastInsertRowid, existed: false });
});

// Привязать документ к категории (используется при импорте)
router.post('/documents/:id/categories', (req, res) => {
  const db = getDB();
  const documentId = req.params.id;
  const { category_id } = req.body;

  db.prepare('INSERT OR IGNORE INTO document_category (document_id, category_id) VALUES (?, ?)').run(documentId, category_id);
  res.json({ success: true });
});

// ==================== КАТЕГОРИИ ====================

// Получить все категории с документом-счётчиком
router.get('/categories', (req, res) => {
  const db = getDB();
  const categories = db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM document_category dc WHERE dc.category_id = c.id) as document_count
    FROM categories c
    ORDER BY c.sort_order
  `).all();
  res.json({ data: categories });
});

// Создать категорию
router.post('/categories', (req, res) => {
  try {
    const db = getDB();
    const { name, slug, type, description, background_image, sort_order, parent_id } = req.body;
    
    const result = db.prepare(`
      INSERT INTO categories (name, slug, type, description, background_image, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, slug, type, description || '', background_image || null, sort_order || 0);

    const newId = result.lastInsertRowid;

    // Добавляем путь к самому себе
    db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, 0)').run(newId, newId);

    // Если указан родитель, добавляем связи
    if (parent_id) {
      // Прямая связь родитель -> новый
      db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, 1)').run(parent_id, newId);
      // Все предки родителя -> новый
      const ancestors = db.prepare('SELECT ancestor_id, depth FROM category_paths WHERE descendant_id = ?').all(parent_id);
      for (const anc of ancestors) {
        if (anc.ancestor_id !== newId) {
          db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)').run(anc.ancestor_id, newId, anc.depth + 1);
        }
      }
    }

    res.json({ id: newId, message: 'Категория создана' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Обновить категорию
router.patch('/categories/:id', (req, res) => {
  try {
    const db = getDB();
    const { name, slug, type, description, background_image, sort_order } = req.body;
    db.prepare(`
      UPDATE categories SET name = ?, slug = ?, type = ?, description = ?, background_image = ?, sort_order = ?
      WHERE id = ?
    `).run(name, slug, type, description, background_image, sort_order, req.params.id);
    res.json({ message: 'Категория обновлена' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Удалить категорию (вместе со всеми связями)
router.delete('/categories/:id', (req, res) => {
  try {
    const db = getDB();
    const catId = req.params.id;

    // Удаляем связи с документами
    db.prepare('DELETE FROM document_category WHERE category_id = ?').run(catId);
    // Удаляем все пути, где категория участвует
    db.prepare('DELETE FROM category_paths WHERE ancestor_id = ? OR descendant_id = ?').run(catId, catId);
    // Удаляем саму категорию
    db.prepare('DELETE FROM categories WHERE id = ?').run(catId);

    res.json({ message: 'Категория удалена' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Создать категорию «на лету» (используется при импорте)
router.post('/categories/ensure', (req, res) => {
  const db = getDB();
  const { name, type, parent_id } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: true, message: 'name и type обязательны' });
  }

  const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9а-яё-]/g, '');

  let cat = db.prepare('SELECT * FROM categories WHERE name = ? AND type = ?').get(name, type);
  if (cat) {
    return res.json({ id: cat.id, existed: true });
  }

  const result = db.prepare('INSERT INTO categories (name, slug, type) VALUES (?, ?, ?)').run(name, slug, type);
  const newId = result.lastInsertRowid;

  db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, 0)').run(newId, newId);

  if (parent_id) {
    db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, 1)').run(parent_id, newId);
    const ancestors = db.prepare('SELECT ancestor_id, depth FROM category_paths WHERE descendant_id = ?').all(parent_id);
    for (const anc of ancestors) {
      if (anc.ancestor_id !== newId) {
        db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)').run(anc.ancestor_id, newId, anc.depth + 1);
      }
    }
  }

  res.json({ id: newId, existed: false });
});

// === Управление связями (category_paths) ===

// Добавить связь между категориями
router.post('/category-paths', (req, res) => {
  const db = getDB();
  const { ancestor_id, descendant_id } = req.body;
  
  if (!ancestor_id || !descendant_id) {
    return res.status(400).json({ error: true, message: 'ancestor_id и descendant_id обязательны' });
  }

  // Проверяем, что категории существуют
  const ancestor = db.prepare('SELECT id FROM categories WHERE id = ?').get(ancestor_id);
  const descendant = db.prepare('SELECT id FROM categories WHERE id = ?').get(descendant_id);
  if (!ancestor || !descendant) {
    return res.status(404).json({ error: true, message: 'Категория не найдена' });
  }

  // Проверяем, что нет цикла (descendant не является предком ancestor)
  const isAncestor = db.prepare('SELECT 1 FROM category_paths WHERE ancestor_id = ? AND descendant_id = ?').get(descendant_id, ancestor_id);
  if (isAncestor) {
    return res.status(400).json({ error: true, message: 'Нельзя создать циклическую связь' });
  }

  // Добавляем прямую связь
  db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, 1)').run(ancestor_id, descendant_id);

  // Добавляем связи от всех предков ancestor к descendant
  const ancestors = db.prepare('SELECT ancestor_id, depth FROM category_paths WHERE descendant_id = ?').all(ancestor_id);
  for (const anc of ancestors) {
    if (anc.ancestor_id !== descendant_id) {
      db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)').run(anc.ancestor_id, descendant_id, anc.depth + 1);
    }
  }

  res.json({ message: 'Связь добавлена' });
});

// Удалить связь между категориями
router.delete('/category-paths/:ancestor_id/:descendant_id', (req, res) => {
  const db = getDB();
  const { ancestor_id, descendant_id } = req.params;

  // Удаляем только прямую связь (depth = 1)
  db.prepare('DELETE FROM category_paths WHERE ancestor_id = ? AND descendant_id = ? AND depth = 1').run(ancestor_id, descendant_id);

  res.json({ message: 'Связь удалена' });
});

// Получить все связи (для админки)
router.get('/category-paths', (req, res) => {
  const db = getDB();
  const paths = db.prepare(`
    SELECT cp.*, a.name as ancestor_name, d.name as descendant_name
    FROM category_paths cp
    JOIN categories a ON cp.ancestor_id = a.id
    JOIN categories d ON cp.descendant_id = d.id
    WHERE cp.depth > 0
    ORDER BY cp.depth
  `).all();
  res.json({ data: paths });
});

// ==================== ТЕГИ ====================

router.get('/tags', (req, res) => {
  const db = getDB();
  const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  res.json({ data: tags });
});

router.post('/tags', (req, res) => {
  try {
    const db = getDB();
    const { name, slug } = req.body;
    const result = db.prepare('INSERT INTO tags (name, slug) VALUES (?, ?)').run(name, slug);
    res.json({ id: result.lastInsertRowid, message: 'Тег создан' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ==================== ПОЛЬЗОВАТЕЛИ ====================

router.get('/users', (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ data: users });
});

router.patch('/users/:id/role', (req, res) => {
  try {
    const db = getDB();
    const { role } = req.body;
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ message: 'Роль обновлена' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ==================== СТАТИСТИКА ====================

router.get('/stats', (req, res) => {
  const db = getDB();
  const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get();
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  const recentDocs = db.prepare('SELECT * FROM documents ORDER BY created_at DESC LIMIT 5').all();
  
  res.json({
    documents: docCount.count,
    users: userCount.count,
    categories: catCount.count,
    recentDocuments: recentDocs
  });
});

// ==================== ИМПОРТ ====================

// Проверка дубликата по SHA-256
router.get('/import/check-hash', (req, res) => {
  const db = getDB();
  const { sha256 } = req.query;
  if (!sha256) return res.status(400).json({ error: true, message: 'Не указан sha256' });
  
  const doc = db.prepare('SELECT id FROM documents WHERE sha256_hash = ?').get(sha256);
  res.json({ exists: !!doc });
});

// Приём batch-импорта с локального ПК
router.post('/import/batch', (req, res) => {
  const db = getDB();
  const { files } = req.body;
  
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: true, message: 'files должен быть массивом' });
  }

  const results = [];
  const insertDoc = db.prepare(`
    INSERT INTO documents (title, author, year, theme, publisher, pages, description, file_type, cloud_path, file_size, sha256_hash, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of files) {
    try {
      const { metadata, cloud_url, file_name, file_size, sha256_hash, extension } = file;
      
      // Проверка дубликата
      const existing = db.prepare('SELECT id FROM documents WHERE sha256_hash = ?').get(sha256_hash);
      if (existing) {
        results.push({ file_name, status: 'skipped', reason: 'duplicate' });
        continue;
      }

      const result = insertDoc.run(
        metadata.title || file_name,
        metadata.author || null,
        metadata.year || null,
        metadata.theme || null,
        metadata.publisher || null,
        metadata.pages || null,
        metadata.description || null,
        extension || 'pdf',
        cloud_url,
        file_size || 0,
        sha256_hash,
        req.user?.id || 1
      );

      results.push({ file_name, status: 'imported', document_id: result.lastInsertRowid });
    } catch (err) {
      results.push({ file_name, status: 'error', reason: err.message });
    }
  }

  res.json({ results });
});

module.exports = router;