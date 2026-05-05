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

// ========== 2. СОЗДАНИЕ КАТЕГОРИЙ (конечные папки с уникальным slug) ==========
console.log('Создаю категории...');
const getCatId = db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?');
const getCatBySlug = db.prepare('SELECT id, type FROM categories WHERE slug = ?');
const insertCat = db.prepare('INSERT INTO categories (name, slug, type) VALUES (?, ?, ?)');

function slugify(text) {
  return text.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9а-яё-]/g, '');
}

function detectType(name) {
  const n = name.toLowerCase();
  if (['производители', 'manufacturers'].includes(n)) return 'root';
  if (['типы оборудования', 'equipment-types'].includes(n)) return 'root';
  if (['акрос', 'derrick', 'mi swaco', 'brandt', 'kem-tron', 'scomi'].includes(n)) return 'manufacturer';
  if (['вибросита', 'центрифуги', 'гидроциклоны', 'дегазаторы', 'центробежные насосы', 'винтовые насосы', 'конвейеры', 'смесительное', 'verti-g', 'ёмкости', 'пво', 'вертлюги', 'приводы и двигатели', 'предохранительные муфты', 'ситовые панели'].includes(n)) return 'equipment-type';
  return 'model';
}

function ensureCategory(name, type, parentSlug = '') {
  // Для конечных папок (model) slug делаем уникальным, включая путь родителя
  let slug;
  if (type === 'model' && parentSlug) {
    slug = slugify(parentSlug + '-' + name);
  } else {
    slug = slugify(name);
  }
  let row = getCatBySlug.get(slug);
  if (row) return row.id;
  insertCat.run(name, slug, type);
  row = getCatBySlug.get(slug);
  return row.id;
}

// Рекурсивно создаём категории, передавая slug родителя для конечных папок
function createCategories(node, parentSlug = '') {
  if (!node || typeof node !== 'object') return;
  for (const [name, content] of Object.entries(node)) {
    const type = detectType(name);
    if (Array.isArray(content)) {
      // Это конечная папка – создаём с родительским slug
      ensureCategory(name, type, parentSlug);
    } else if (typeof content === 'object') {
      const catId = ensureCategory(name, type);
      // Получаем slug созданной категории для передачи вглубь
      const catSlug = getCatBySlug.get(slugify(name)).slug; // или regenerate
      createCategories(content, catSlug);
    }
  }
}

console.log('  by_type...');
createCategories(data.hierarchies.by_type, '');
console.log('  by_manufacturer...');
createCategories(data.hierarchies.by_manufacturer, '');

// Корневые разделы
ensureCategory('Производители', 'root');
ensureCategory('Типы оборудования', 'root');

console.log(`Категорий создано: ${db.prepare('SELECT COUNT(*) as cnt FROM categories').get().cnt}`);

// ========== 3. ПОСТРОЕНИЕ СВЯЗЕЙ (CATEGORY_PATHS) ==========
console.log('Строю связи...');
const insertPath = db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)');

function buildLinks(node, parentSlug = '', depth = 0, parentId = null) {
  if (!node || typeof node !== 'object') return;
  for (const [name, content] of Object.entries(node)) {
    const type = detectType(name);
    let slug;
    if (type === 'model' && parentSlug) {
      slug = slugify(parentSlug + '-' + name);
    } else {
      slug = slugify(name);
    }
    const cat = getCatBySlug.get(slug);
    if (!cat) continue;
    const catId = cat.id;

    insertPath.run(catId, catId, 0);
    if (parentId) {
      insertPath.run(parentId, catId, depth);
    }

    if (typeof content === 'object' && !Array.isArray(content)) {
      buildLinks(content, slug, depth + 1, catId);
    }
  }
}

buildLinks(data.hierarchies.by_type, '', 0, null);
buildLinks(data.hierarchies.by_manufacturer, '', 0, null);

// Связываем корни
const manufacturersRoot = ensureCategory('Производители', 'root');
const equipmentTypesRoot = ensureCategory('Типы оборудования', 'root');

const allManufacturers = db.prepare("SELECT id FROM categories WHERE type='manufacturer' AND name!='Производители'").all();
const allEquipmentTypes = db.prepare("SELECT id FROM categories WHERE type='equipment-type' AND name!='Типы оборудования'").all();

for (const m of allManufacturers) insertPath.run(manufacturersRoot, m.id, 1);
for (const t of allEquipmentTypes) insertPath.run(equipmentTypesRoot, t.id, 1);

console.log(`Связей создано: ${db.prepare('SELECT COUNT(*) as cnt FROM category_paths WHERE depth > 0').get().cnt}`);

// ========== 4. ПРИВЯЗКА ДОКУМЕНТОВ ==========
console.log('Привязываю документы...');
const getDocId = db.prepare('SELECT id FROM documents WHERE source_path = ?');
const insertDocCat = db.prepare('INSERT OR IGNORE INTO document_category (document_id, category_id) VALUES (?, ?)');

// Поиск конечной категории по source_path с учётом полного slug
function findModelForDoc(node, sourcePath, parentSlug = '') {
  if (!node || typeof node !== 'object') return null;
  for (const [name, content] of Object.entries(node)) {
    const type = detectType(name);
    if (Array.isArray(content)) {
      const found = content.some(d => d.path === sourcePath);
      if (found) {
        const slug = (type === 'model' && parentSlug) ? slugify(parentSlug + '-' + name) : slugify(name);
        return getCatBySlug.get(slug)?.id || null;
      }
    } else if (typeof content === 'object') {
      const childSlug = slugify(name);
      const res = findModelForDoc(content, sourcePath, childSlug);
      if (res) return res;
    }
  }
  return null;
}

const allDocs = db.prepare('SELECT id, source_path FROM documents WHERE source_path IS NOT NULL').all();
let linked = 0, skipped = 0;
for (const doc of allDocs) {
  let catId = findModelForDoc(data.hierarchies.by_type, doc.source_path, '');
  if (!catId) catId = findModelForDoc(data.hierarchies.by_manufacturer, doc.source_path, '');
  if (!catId) { skipped++; continue; }
  insertDocCat.run(doc.id, catId);
  linked++;
}
console.log(`Привязано документов: ${linked}, пропущено: ${skipped}`);
console.log('======== ГОТОВО ========');
console.log('Теперь конечные папки уникальны для каждой ветки, подсчёт будет точным.');