const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('db/library.db');

const JSON_PATH = '/home/nodejs/library/library.json';

if (!fs.existsSync(JSON_PATH)) {
  console.error('library.json не найден');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// Очищаем старые связи
db.exec('DELETE FROM category_paths WHERE depth > 0');

// Подготовленные запросы
const getCatId = db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?');
const insertCategory = db.prepare(`
  INSERT INTO categories (name, slug, type) VALUES (?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET type = excluded.type
`);
const getCatIdBySlug = db.prepare('SELECT id FROM categories WHERE slug = ?');
const insertPath = db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)');

function slugify(name) {
  return name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9а-яё-]/g, '').substring(0, 200);
}

function detectType(name) {
  const n = name.toLowerCase();
  if (['производители', 'manufacturers'].includes(n)) return 'root';
  if (['типы оборудования', 'equipment-types'].includes(n)) return 'root';
  if (['акрос', 'derrick', 'mi swaco', 'brandt', 'kem-tron', 'scomi'].includes(n)) return 'manufacturer';
  if (['вибросита', 'центрифуги', 'гидроциклоны', 'дегазаторы', 'центробежные насосы', 'винтовые насосы', 'конвейеры', 'смесительное', 'verti-g', 'ёмкости', 'пво', 'вертлюги', 'приводы и двигатели', 'предохранительные муфты', 'ситовые панели'].includes(n)) return 'equipment-type';
  return 'imported';
}

function ensureCategoryId(name, type) {
  const slug = slugify(name);
  let row = getCatIdBySlug.get(slug);
  if (row) {
    db.prepare('UPDATE categories SET type = ? WHERE id = ?').run(type, row.id);
    return row.id;
  }
  insertCategory.run(name, slug, type);
  row = getCatIdBySlug.get(slug);
  return row.id;
}

// Собираем пары (тип оборудования, производитель) из by_type
function collectTypeManufacturerPairs(node, currentType = null) {
  if (!node || typeof node !== 'object') return;

  for (const [key, content] of Object.entries(node)) {
    if (currentType) {
      // currentType – это тип оборудования, key – производитель
      if (typeof content === 'object' && content !== null) {
        const typeCatId = ensureCategoryId(currentType, 'equipment-type');
        const manCatId = ensureCategoryId(key, 'manufacturer');
        insertPath.run(typeCatId, manCatId, 1);
        console.log(`Связь: ${currentType} -> ${key}`);
      }
      // внутри производителя могут быть модели – пропускаем
    } else {
      // верхний уровень – запоминаем тип оборудования
      if (typeof content === 'object' && content !== null) {
        // key – тип оборудования
        collectTypeManufacturerPairs(content, key);
      }
    }
  }
}

// Собираем пары (производитель, тип оборудования) из by_manufacturer
function collectManufacturerTypePairs(node, currentMan = null) {
  if (!node || typeof node !== 'object') return;

  for (const [key, content] of Object.entries(node)) {
    if (currentMan) {
      // currentMan – производитель, key – тип оборудования
      if (typeof content === 'object' && content !== null) {
        const manCatId = ensureCategoryId(currentMan, 'manufacturer');
        const typeCatId = ensureCategoryId(key, 'equipment-type');
        insertPath.run(manCatId, typeCatId, 1);
        console.log(`Связь: ${currentMan} -> ${key}`);
      }
    } else {
      if (typeof content === 'object' && content !== null) {
        collectManufacturerTypePairs(content, key);
      }
    }
  }
}

// Выполняем сбор
console.log('Строю связи Тип -> Производитель...');
collectTypeManufacturerPairs(data.hierarchies.by_type);

console.log('Строю связи Производитель -> Тип...');
collectManufacturerTypePairs(data.hierarchies.by_manufacturer);

// Корневые разделы
const manRootId = ensureCategoryId('Производители', 'root');
const typeRootId = ensureCategoryId('Типы оборудования', 'root');

const mans = db.prepare("SELECT id FROM categories WHERE type = 'manufacturer' AND name != 'Производители'").all();
const types = db.prepare("SELECT id FROM categories WHERE type = 'equipment-type' AND name != 'Типы оборудования'").all();

for (const m of mans) insertPath.run(manRootId, m.id, 1);
for (const t of types) insertPath.run(typeRootId, t.id, 1);

console.log('Готово!');
console.log(`Всего связей: ${db.prepare('SELECT COUNT(*) as cnt FROM category_paths WHERE depth > 0').get().cnt}`);