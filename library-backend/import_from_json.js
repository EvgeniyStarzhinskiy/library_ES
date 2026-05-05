const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const db = new Database('db/library.db');

const JSON_PATH = '/home/nodejs/library/library.json';

if (!fs.existsSync(JSON_PATH)) {
  console.error('library.json не найден на сервере. Сначала скопируй его с ПК в /home/nodejs/library/');
  process.exit(1);
}

console.log('Читаю library.json...');
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// Подготовленные запросы
const selectCategory = db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?');
const insertCategory = db.prepare('INSERT INTO categories (name, slug, type) VALUES (?, ?, ?)');
const insertPath = db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)');
const selectDocument = db.prepare('SELECT id FROM documents WHERE source_path = ?');
const insertDocument = db.prepare(`
  INSERT INTO documents (title, author, file_type, cloud_path, source_path, uploaded_by)
  VALUES (?, ?, ?, ?, ?, 1)
`);
const linkDocCat = db.prepare('INSERT OR IGNORE INTO document_category (document_id, category_id) VALUES (?, ?)');

// Рекурсивный обход иерархии
async function processHierarchy(hierarchyObj) {
  let totalDocs = 0;
  let newDocs = 0;
  
  function walk(node, parentId = null, catPath = []) {
    for (const [name, content] of Object.entries(node)) {
      const type = catPath.length === 0 ? 'root' : 'imported';
      
      // Генерируем уникальный slug
      const slugBase = name.toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^a-z0-9а-яё-]/g, '');
      const slug = type === 'root' ? slugBase : `${slugBase}-${type}-${catPath.join('-')}`.substring(0, 200);
      
      // Создаём категорию
      let catRow = selectCategory.get(name, type);
      let catId;
      if (catRow) {
        catId = catRow.id;
      } else {
        try {
          const result = insertCategory.run(name, slug, type);
          catId = result.lastInsertRowid;
        } catch (err) {
          // Если slug всё равно не уникален, пробуем с суффиксом
          const altSlug = `${slug}-${Date.now()}`;
          const result = insertCategory.run(name, altSlug, type);
          catId = result.lastInsertRowid;
        }
      }
      
      // Добавляем путь к самому себе
      insertPath.run(catId, catId, 0);
      if (parentId) {
        insertPath.run(parentId, catId, 1);
      }

      const currentPath = [...catPath, name];

      if (Array.isArray(content)) {
        // Это лист с документами
        const docCount = content.length;
        totalDocs += docCount;
        console.log(`  ${currentPath.join(' → ')}: ${docCount} док.`);
        
        for (const doc of content) {
          const fileName = doc.name || doc.path.split('\\').pop();
          
          // Проверка дубликата по source_path
          const existing = selectDocument.get(doc.path);
          if (existing) continue;

          const fileType = (doc.type || '.pdf').replace('.', '');
          try {
            const result = insertDocument.run(fileName, '', fileType, '', doc.path);
            linkDocCat.run(result.lastInsertRowid, catId);
            newDocs++;
          } catch (err) {
            console.error(`    Ошибка: ${fileName} - ${err.message}`);
          }
        }
      } else if (typeof content === 'object' && content !== null) {
        walk(content, catId, currentPath);
      }
    }
  }
  
  walk(hierarchyObj);
  console.log(`  Итого: ${totalDocs} документов, ${newDocs} новых`);
}

(async () => {
  console.log('=== Импорт by_type ===');
  await processHierarchy(data.hierarchies.by_type);
  
  if (data.hierarchies.by_manufacturer) {
    console.log('\n=== Импорт by_manufacturer (дополнительные связи) ===');
    await processHierarchy(data.hierarchies.by_manufacturer);
  }
  
  console.log('\nИмпорт завершён!');
})();