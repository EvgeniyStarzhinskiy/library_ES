const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('db/library.db');

const JSON_PATH = '/home/nodejs/library/library.json';
if (!fs.existsSync(JSON_PATH)) {
  console.error('library.json не найден');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// ========== 1. ПОЛНАЯ ОЧИСТКА ==========
console.log('Очищаю старую структуру...');
db.exec('DELETE FROM document_category');
db.exec('DELETE FROM category_paths');
db.exec('DELETE FROM categories');

// ========== 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
const insertCat = db.prepare('INSERT INTO categories (name, slug, type) VALUES (?, ?, ?)');
const getCatBySlug = db.prepare('SELECT id, type FROM categories WHERE slug = ?');

function detectType(name) {
  const n = name.toLowerCase();
  if (['производители', 'manufacturers'].includes(n)) return 'root';
  if (['типы оборудования', 'equipment-types'].includes(n)) return 'root';
  if (['акрос', 'derrick', 'mi swaco', 'brandt', 'kem-tron', 'scomi'].includes(n)) return 'manufacturer';
  if (['вибросита', 'центрифуги', 'гидроциклоны', 'дегазаторы', 'центробежные насосы', 'винтовые насосы', 'конвейеры', 'смесительное', 'verti-g', 'ёмкости', 'пво', 'вертлюги', 'приводы и двигатели', 'предохранительные муфты', 'ситовые панели'].includes(n)) return 'equipment-type';
  return 'model';
}

// Создаёт slug из массива частей пути, разделяя их "--"
function makeSlug(parts) {
  return parts.map(p => p.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9а-яё-]/g, '')).join('--');
}

// Рекурсивно создаём категории
function createCategories(node, parentPath = []) {
  if (!node || typeof node !== 'object') return;
  for (const [name, content] of Object.entries(node)) {
    const currentPath = [...parentPath, name];
    const type = detectType(name);
    if (Array.isArray(content)) {
      // Конечная папка
      const slug = makeSlug(currentPath);
      insertCat.run(name, slug, type);
    } else if (typeof content === 'object') {
      const slug = makeSlug(currentPath);
      insertCat.run(name, slug, type);
      createCategories(content, currentPath);
    }
  }
}

// ========== 3. СОЗДАНИЕ КАТЕГОРИЙ ==========
console.log('Создаю категории (slug = полный путь) ...');
createCategories(data.hierarchies.by_type, []);
createCategories(data.hierarchies.by_brand, []);

// Корневые разделы
insertCat.run('Производители', 'manufacturers', 'root');
insertCat.run('Типы оборудования', 'equipment-types', 'root');

console.log(`Категорий создано: ${db.prepare('SELECT COUNT(*) as cnt FROM categories').get().cnt}`);

// ========== 4. ПОСТРОЕНИЕ СВЯЗЕЙ (category_paths) ==========
console.log('Строю связи...');
const insertPath = db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)');

function buildLinks(node, parentPath = [], depth = 0, parentId = null) {
  if (!node || typeof node !== 'object') return;
  for (const [name, content] of Object.entries(node)) {
    const currentPath = [...parentPath, name];
    const slug = makeSlug(currentPath);
    const cat = getCatBySlug.get(slug);
    if (!cat) continue;

    insertPath.run(cat.id, cat.id, 0);
    if (parentId) {
      insertPath.run(parentId, cat.id, depth);
    }

    if (typeof content === 'object' && !Array.isArray(content)) {
      buildLinks(content, currentPath, depth + 1, cat.id);
    }
  }
}

buildLinks(data.hierarchies.by_type, [], 0, null);
buildLinks(data.hierarchies.by_brand, [], 0, null);

// Связываем корневые разделы с производителями и типами оборудования
const manufacturersRoot = getCatBySlug.get('manufacturers').id;
const equipmentTypesRoot = getCatBySlug.get('equipment-types').id;

const allManufacturers = db.prepare("SELECT id FROM categories WHERE type='manufacturer' AND name!='Производители'").all();
const allEquipmentTypes = db.prepare("SELECT id FROM categories WHERE type='equipment-type' AND name!='Типы оборудования'").all();

for (const m of allManufacturers) insertPath.run(manufacturersRoot, m.id, 1);
for (const t of allEquipmentTypes) insertPath.run(equipmentTypesRoot, t.id, 1);

console.log(`Связей создано: ${db.prepare('SELECT COUNT(*) as cnt FROM category_paths WHERE depth > 0').get().cnt}`);

// ========== 5. ПРИВЯЗКА ДОКУМЕНТОВ ==========
console.log('Привязываю документы...');
const getDocId = db.prepare('SELECT id FROM documents WHERE source_path = ?');
const insertDocCat = db.prepare('INSERT OR IGNORE INTO document_category (document_id, category_id) VALUES (?, ?)');

function findLeafPath(node, sourcePath, parentPath = []) {
  if (!node || typeof node !== 'object') return null;
  for (const [name, content] of Object.entries(node)) {
    const currentPath = [...parentPath, name];
    if (Array.isArray(content)) {
      const found = content.some(d => d.path === sourcePath);
      if (found) return currentPath;
    } else if (typeof content === 'object') {
      const res = findLeafPath(content, sourcePath, currentPath);
      if (res) return res;
    }
  }
  return null;
}

const allDocs = db.prepare('SELECT id, source_path FROM documents WHERE source_path IS NOT NULL').all();
let linked = 0, skipped = 0;
for (const doc of allDocs) {
  let pathArray = findLeafPath(data.hierarchies.by_type, doc.source_path, []);
  if (!pathArray) pathArray = findLeafPath(data.hierarchies.by_brand, doc.source_path, []);
  if (!pathArray) { skipped++; continue; }
  const slug = makeSlug(pathArray);
  const cat = getCatBySlug.get(slug);
  if (cat) {
    insertDocCat.run(doc.id, cat.id);
    linked++;
  } else {
    skipped++;
  }
}
console.log(`Привязано документов: ${linked}, пропущено: ${skipped}`);
console.log('======== ГОТОВО ========');