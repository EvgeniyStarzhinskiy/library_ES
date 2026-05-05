const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { getDB } = require('../db/init');
const { downloadFromCloud } = require('../services/cloudStorage');

const router = express.Router();

// ==================== ПУБЛИЧНЫЕ МАРШРУТЫ ====================

// Полнотекстовый поиск с фильтрами
router.get('/search', (req, res) => {
  try {
    const db = getDB();
    const { q, page = 1, limit = 20, author, tag, year_from, year_to, file_type } = req.query;

    // Очищаем поисковый запрос от спецсимволов, опасных для FTS5
    let cleanQ = q ? q.replace(/[#@&~^*(){}[\]\\|:;"'<>,.?]/g, ' ') : '';
    cleanQ = cleanQ.trim();

    const where = [];
    const params = [];

    if (cleanQ) {
      where.push('documents_fts MATCH ?');
      params.push(cleanQ);
    }
    if (author) {
      where.push('d.author LIKE ?');
      params.push(`%${author}%`);
    }
    if (tag) {
      where.push('t.slug = ?');
      params.push(tag);
    }
    if (year_from) {
      where.push('d.year >= ?');
      params.push(Number(year_from));
    }
    if (year_to) {
      where.push('d.year <= ?');
      params.push(Number(year_to));
    }
    if (file_type) {
      where.push('d.file_type = ?');
      params.push(file_type);
    }

    const offset = (Number(page) - 1) * Number(limit);
    const whereStr = where.length > 0
      ? `WHERE ${where.join(' AND ')} AND (d.is_published IS NULL OR d.is_published = 1)`
      : `WHERE (d.is_published IS NULL OR d.is_published = 1)`;

    let query;
    if (cleanQ) {
      query = `
        SELECT d.*,
          COALESCE(AVG(r.stars), 0) as avg_rating,
          COUNT(DISTINCT r.user_id) as rating_count
        FROM documents_fts fts
        JOIN documents d ON fts.rowid = d.id
        LEFT JOIN ratings r ON d.id = r.document_id
        LEFT JOIN document_tag dt ON d.id = dt.document_id
        LEFT JOIN tags t ON dt.tag_id = t.id
        ${whereStr}
        GROUP BY d.id
        ORDER BY rank
        LIMIT ? OFFSET ?
      `;
    } else {
      query = `
        SELECT DISTINCT d.*,
          COALESCE(AVG(r.stars), 0) as avg_rating,
          COUNT(DISTINCT r.user_id) as rating_count
        FROM documents d
        LEFT JOIN ratings r ON d.id = r.document_id
        LEFT JOIN document_tag dt ON d.id = dt.document_id
        LEFT JOIN tags t ON dt.tag_id = t.id
        ${whereStr}
        GROUP BY d.id
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
      `;
    }

    params.push(Number(limit), offset);
    const docs = db.prepare(query).all(...params);

    // Подсчёт общего количества
    let countQuery;
    if (cleanQ) {
      countQuery = `SELECT COUNT(*) as cnt FROM documents_fts fts JOIN documents d ON fts.rowid = d.id ${whereStr}`;
    } else {
      countQuery = `SELECT COUNT(DISTINCT d.id) as cnt FROM documents d LEFT JOIN document_tag dt ON d.id = dt.document_id LEFT JOIN tags t ON dt.tag_id = t.id ${whereStr}`;
    }
    const totalRow = db.prepare(countQuery).all(...params.slice(0, -2));
    const total = totalRow[0]?.cnt || 0;

    res.json({ data: docs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Ошибка поиска:', err);
    res.status(500).json({ error: true, message: err.message });
  }
});

// Автодополнение с авторами и тегами
router.get('/search/suggest', (req, res) => {
  try {
    const db = getDB();
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    // Очищаем запрос и для FTS
    const cleanQ = q.replace(/[#@&~^*(){}[\]\\|:;"'<>,.?]/g, ' ').trim();

    const titles = db.prepare(`SELECT title FROM documents_fts WHERE documents_fts MATCH ? LIMIT 3`).all(cleanQ)
      .map(r => ({ type: 'title', value: r.title }));

    const authors = db.prepare(`SELECT DISTINCT author FROM documents WHERE author LIKE ? AND author IS NOT NULL LIMIT 2`)
      .all(`%${q}%`).map(r => ({ type: 'author', value: r.author }));

    const tags = db.prepare(`SELECT name, slug FROM tags WHERE name LIKE ? LIMIT 2`)
      .all(`%${q}%`).map(r => ({ type: 'tag', value: r.name, slug: r.slug }));

    res.json([...titles, ...authors, ...tags]);
  } catch (err) {
    res.json([]);
  }
});

// Получить список документов с фильтрацией и пагинацией
router.get('/', (req, res) => {
  const db = getDB();
  const { page = 1, limit = 10, search, category_id, tag, author, year_from, year_to, sort } = req.query;

  let query = `
    SELECT DISTINCT d.*,
      COALESCE(AVG(r.stars), 0) as avg_rating,
      COUNT(DISTINCT r.user_id) as rating_count
    FROM documents d
    LEFT JOIN ratings r ON d.id = r.document_id
    LEFT JOIN document_category dc ON d.id = dc.document_id
    LEFT JOIN document_tag dt ON d.id = dt.document_id
    LEFT JOIN tags t ON dt.tag_id = t.id
    WHERE (d.is_published IS NULL OR d.is_published = 1)
  `;
  const params = [];

  if (search) {
    query += ' AND (d.title LIKE ? OR d.description LIKE ? OR d.author LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category_id) {
    query += ' AND dc.category_id = ?';
    params.push(category_id);
  }
  if (tag) {
    query += ' AND t.slug = ?';
    params.push(tag);
  }
  if (author) {
    query += ' AND d.author LIKE ?';
    params.push(`%${author}%`);
  }
  if (year_from) {
    query += ' AND d.year >= ?';
    params.push(year_from);
  }
  if (year_to) {
    query += ' AND d.year <= ?';
    params.push(year_to);
  }

  query += ' GROUP BY d.id';

  if (sort === 'rating') query += ' ORDER BY avg_rating DESC';
  else if (sort === 'title') query += ' ORDER BY d.title ASC';
  else if (sort === 'year') query += ' ORDER BY d.year DESC';
  else query += ' ORDER BY d.created_at DESC';

  const offset = (Number(page) - 1) * Number(limit);
  query += ' LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  try {
    const documents = db.prepare(query).all(...params);
    const countQuery = 'SELECT COUNT(DISTINCT d.id) as count FROM documents d WHERE (d.is_published IS NULL OR d.is_published = 1)';
    const total = db.prepare(countQuery).get();
    res.json({ data: documents, total: total.count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Ошибка получения документов:', err);
    res.status(500).json({ error: true, message: err.message });
  }
});

// Получить один документ
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const document = db.prepare(`
      SELECT d.*,
        COALESCE(AVG(r.stars), 0) as avg_rating,
        COUNT(DISTINCT r.user_id) as rating_count
      FROM documents d
      LEFT JOIN ratings r ON d.id = r.document_id
      WHERE d.id = ? AND (d.is_published IS NULL OR d.is_published = 1)
      GROUP BY d.id
    `).get(req.params.id);

    if (!document) {
      return res.status(404).json({ error: true, message: 'Документ не найден' });
    }

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

    res.json({ ...document, tags, categories });
  } catch (err) {
    console.error('Ошибка получения документа:', err);
    res.status(500).json({ error: true, message: err.message });
  }
});

// Просмотр документа (проксирование с Яндекс.Диска)
router.get('/:id/view', async (req, res) => {
  try {
    const db = getDB();
    const document = db.prepare(
      'SELECT * FROM documents WHERE id = ? AND (is_published IS NULL OR is_published = 1)'
    ).get(req.params.id);

    if (!document) {
      return res.status(404).json({ error: true, message: 'Документ не найден' });
    }

    if (!document.cloud_path) {
      return res.status(404).json({ error: true, message: 'Файл ещё не загружен в облако' });
    }

    const fileExt = (document.file_type || 'pdf').toLowerCase();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'djvu': 'image/vnd.djvu',
      'txt': 'text/plain; charset=utf-8',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    const contentType = mimeTypes[fileExt] || 'application/octet-stream';

    const relativePath = document.cloud_path.replace(/^\/Library\//, '');
    const lastSlash = relativePath.lastIndexOf('/');
    const folder = relativePath.substring(0, lastSlash);
    const cloudFileName = relativePath.substring(lastSlash + 1);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.title)}.${fileExt}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');

    await downloadFromCloud(folder, cloudFileName, res);
  } catch (err) {
    console.error('Ошибка просмотра:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: true, message: 'Ошибка загрузки файла' });
    }
  }
});

// Скачать документ (требуется авторизация)
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const db = getDB();
    const document = db.prepare(
      'SELECT * FROM documents WHERE id = ? AND (is_published IS NULL OR is_published = 1)'
    ).get(req.params.id);

    if (!document) {
      return res.status(404).json({ error: true, message: 'Документ не найден' });
    }

    if (!document.cloud_path) {
      return res.status(404).json({ error: true, message: 'Файл ещё не загружен в облако' });
    }

    const fileExt = (document.file_type || 'pdf').toLowerCase();
    const fileName = `${document.title || 'document'}.${fileExt}`;

    const relativePath = document.cloud_path.replace(/^\/Library\//, '');
    const lastSlash = relativePath.lastIndexOf('/');
    const folder = relativePath.substring(0, lastSlash);
    const cloudFileName = relativePath.substring(lastSlash + 1);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'no-cache');

    await downloadFromCloud(folder, cloudFileName, res);
  } catch (err) {
    console.error('Ошибка скачивания:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: true, message: 'Ошибка при скачивании файла' });
    }
  }
});

// Превью документа (проксируем JPEG из облака)
router.get('/:id/preview', async (req, res) => {
  try {
    const db = getDB();
    const doc = db.prepare('SELECT preview_cloud_path FROM documents WHERE id = ?').get(req.params.id);
    if (!doc?.preview_cloud_path) {
      return res.status(404).json({ error: true, message: 'Превью отсутствует' });
    }
    const relativePath = doc.preview_cloud_path.replace(/^\/Library\//, '');
    const lastSlash = relativePath.lastIndexOf('/');
    const folder = relativePath.substring(0, lastSlash);
    const fileName = relativePath.substring(lastSlash + 1);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    await downloadFromCloud(folder, fileName, res);
  } catch (err) {
    console.error('Ошибка превью:', err);
    res.status(500).json({ error: true, message: 'Ошибка загрузки превью' });
  }
});

module.exports = router;