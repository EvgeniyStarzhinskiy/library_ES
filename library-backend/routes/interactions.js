const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDB } = require('../db/init');

const router = express.Router();

// Все маршруты требуют авторизации
router.use(authenticateToken);

// ==================== ИЗБРАННОЕ ====================

// Добавить в избранное
router.post('/favorites/:documentId', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const documentId = req.params.documentId;

    // Проверяем, существует ли документ
    const doc = db.prepare('SELECT id FROM documents WHERE id = ? AND is_published = 1').get(documentId);
    if (!doc) {
      return res.status(404).json({ error: true, message: 'Документ не найден' });
    }

    // Добавляем (игнорируем, если уже есть)
    db.prepare('INSERT OR IGNORE INTO favorites (user_id, document_id) VALUES (?, ?)').run(userId, documentId);
    
    res.json({ message: 'Добавлено в избранное' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Удалить из избранного
router.delete('/favorites/:documentId', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const documentId = req.params.documentId;

    db.prepare('DELETE FROM favorites WHERE user_id = ? AND document_id = ?').run(userId, documentId);
    
    res.json({ message: 'Удалено из избранного' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Получить статус избранного для документа
router.get('/favorites/:documentId/status', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const documentId = req.params.documentId;

    const fav = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND document_id = ?').get(userId, documentId);
    
    res.json({ isFavorite: !!fav });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Получить всё избранное пользователя
router.get('/favorites', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;

    const favorites = db.prepare(`
      SELECT d.*, f.created_at as favorited_at
      FROM favorites f
      JOIN documents d ON f.document_id = d.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `).all(userId);

    res.json({ data: favorites });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ==================== РЕЙТИНГИ ====================

// Поставить оценку
router.post('/ratings/:documentId', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const documentId = req.params.documentId;
    const { stars } = req.body;

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: true, message: 'Оценка должна быть от 1 до 5' });
    }

    // Проверяем существование документа
    const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(documentId);
    if (!doc) {
      return res.status(404).json({ error: true, message: 'Документ не найден' });
    }

    // Вставляем или обновляем
    db.prepare(`
      INSERT INTO ratings (user_id, document_id, stars) 
      VALUES (?, ?, ?) 
      ON CONFLICT(user_id, document_id) DO UPDATE SET stars = ?, created_at = datetime('now')
    `).run(userId, documentId, stars, stars);

    // Получаем новый средний рейтинг
    const avg = db.prepare('SELECT AVG(stars) as avg_rating, COUNT(*) as count FROM ratings WHERE document_id = ?').get(documentId);
    
    res.json({ 
      message: 'Оценка сохранена', 
      avg_rating: Math.round(avg.avg_rating * 10) / 10,
      count: avg.count 
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Получить оценку пользователя для документа
router.get('/ratings/:documentId/my', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const documentId = req.params.documentId;

    const rating = db.prepare('SELECT stars FROM ratings WHERE user_id = ? AND document_id = ?').get(userId, documentId);
    
    res.json({ stars: rating ? rating.stars : 0 });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ==================== КОММЕНТАРИИ ====================

// Получить комментарии к документу
router.get('/comments/:documentId', (req, res) => {
  try {
    const db = getDB();
    const documentId = req.params.documentId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Получаем корневые комментарии с пагинацией
    const comments = db.prepare(`
      SELECT c.*, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id AND r.is_moderated = 1) as replies_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.document_id = ? AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(documentId, Number(limit), offset);

    res.json({ data: comments });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Получить ответы на комментарий
router.get('/comments/:commentId/replies', (req, res) => {
  try {
    const db = getDB();
    const commentId = req.params.commentId;

    const replies = db.prepare(`
      SELECT c.*, u.display_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.parent_id = ?
      ORDER BY c.created_at ASC
    `).all(commentId);

    res.json({ data: replies });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Добавить комментарий
router.post('/comments/:documentId', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const documentId = req.params.documentId;
    const { content, parent_id } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: true, message: 'Комментарий не может быть пустым' });
    }

    // Проверяем документ
    const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(documentId);
    if (!doc) {
      return res.status(404).json({ error: true, message: 'Документ не найден' });
    }

    // Если это ответ, проверяем родительский комментарий
    if (parent_id) {
      const parent = db.prepare('SELECT id, document_id FROM comments WHERE id = ?').get(parent_id);
      if (!parent || parent.document_id != documentId) {
        return res.status(400).json({ error: true, message: 'Родительский комментарий не найден' });
      }
    }

    // Авто-модерация: для админов сразу публикуем
    const isModerated = req.user.role === 'admin' ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO comments (user_id, document_id, parent_id, content, is_moderated)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, documentId, parent_id || null, content.trim(), isModerated);

    res.json({ 
      id: result.lastInsertRowid, 
      message: isModerated ? 'Комментарий опубликован' : 'Комментарий отправлен на модерацию' 
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Пожаловаться на комментарий
router.post('/comments/:id/complaint', (req, res) => {
  try {
    const db = getDB();
    const commentId = req.params.id;

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
      return res.status(404).json({ error: true, message: 'Комментарий не найден' });
    }

    db.prepare('UPDATE comments SET complaint_flag = 1 WHERE id = ?').run(commentId);
    
    res.json({ message: 'Жалоба отправлена' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// Список пожертвований пользователя
router.get('/donations', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const donations = db.prepare('SELECT * FROM donations WHERE user_id = ? ORDER BY donated_at DESC').all(userId);
  res.json({ data: donations });
});

// Список избранного с полной информацией о документах
router.get('/favorites', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const favorites = db.prepare(`
    SELECT d.*, f.created_at as favorited_at
    FROM favorites f
    JOIN documents d ON f.document_id = d.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(userId);
  res.json({ data: favorites });
});

module.exports = router;