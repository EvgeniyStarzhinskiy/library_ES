const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('db/library.db');

const JSON_PATH = '/home/nodejs/library/library.json';
if (!fs.existsSync(JSON_PATH)) {
  console.error('library.json не найден');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const getCatByNameType = db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?');
const insertPath = db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)');

// Функция для добавления связей из иерархии, где на верхнем уровне – родители, на втором – дети
function addLinks(parentType, childType, hierarchy) {
  if (!hierarchy || typeof hierarchy !== 'object') return;
  for (const [parentName, childrenObj] of Object.entries(hierarchy)) {
    const parentRow = getCatByNameType.get(parentName, parentType);
    if (!parentRow) {
      console.log(`⚠ Пропущен ${parentType}: "${parentName}"`);
      continue;
    }
    if (!childrenObj || typeof childrenObj !== 'object') continue;
    for (const childName of Object.keys(childrenObj)) {
      const childRow = getCatByNameType.get(childName, childType);
      if (!childRow) {
        console.log(`⚠ Пропущен ${childType}: "${childName}"`);
        continue;
      }
      insertPath.run(parentRow.id, childRow.id, 1);
    }
  }
}

console.log('Добавляю связи по by_type (Тип → Производитель)...');
addLinks('equipment-type', 'manufacturer', data.hierarchies.by_type);

console.log('Добавляю связи по by_brand (Производитель → Тип)...');
addLinks('manufacturer', 'equipment-type', data.hierarchies.by_brand);

console.log('Готово! Проверьте навигацию.');