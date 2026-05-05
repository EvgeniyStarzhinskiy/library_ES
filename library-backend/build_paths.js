const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('db/library.db');

const JSON_PATH = '/home/nodejs/library/library.json';

if (!fs.existsSync(JSON_PATH)) {
  console.error('library.json не найден');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// Очистим старые пути
db.exec('DELETE FROM category_paths WHERE depth > 0');

const insertCategory = db.prepare(`
  INSERT INTO categories (name, slug, type) VALUES (?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET type = excluded.type
`);
const getCategoryIdBySlug = db.prepare('SELECT id, type FROM categories WHERE slug = ?');
const insertPath = db.prepare(`
  INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)
`);

function slugify(name) {
  return name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9а-яё-]/g, '').substring(0, 200);
}

function detectType(name, depth, isManufacturerTree) {
  if (depth === 0) {
    return isManufacturerTree ? 'manufacturer' : 'equipment-type';
  } else if (depth >= 1) {
    return isManufacturerTree ? 'equipment-type' : 'manufacturer';
  }
  return 'imported';
}

function ensureCategoryId(name, type) {
  const slug = slugify(name);
  let row = getCategoryIdBySlug.get(slug);
  if (row) {
    if (row.type !== type) {
      db.prepare('UPDATE categories SET type = ? WHERE id = ?').run(type, row.id);
    }
    return row.id;
  }
  insertCategory.run(name, slug, type);
  row = getCategoryIdBySlug.get(slug);
  return row.id;
}

async function processHierarchy(hierarchyObj, isManufacturerTree = false) {
  async function walk(node, parentId = null, depth = 0) {
    if (!node || typeof node !== 'object') return;
    for (const [name, content] of Object.entries(node)) {
      const type = detectType(name, depth, isManufacturerTree);
      const catId = ensureCategoryId(name, type);

      if (parentId) {
        insertPath.run(parentId, catId, depth);
      }

      if (Array.isArray(content)) {
        // лист – конец
      } else if (typeof content === 'object' && content !== null) {
        await walk(content, catId, depth + 1);
      }
    }
  }
  await walk(hierarchyObj);
}

(async () => {
  console.log('Обрабатываю by_type...');
  if (data.hierarchies.by_type) {
    await processHierarchy(data.hierarchies.by_type, false);
  }

  console.log('Обрабатываю by_manufacturer...');
  if (data.hierarchies.by_manufacturer) {
    await processHierarchy(data.hierarchies.by_manufacturer, true);
  }

  // Корневые узлы для оси навигации
  const ensureRoot = (name, slug, type) => {
    let row = getCategoryIdBySlug.get(slug);
    if (!row) {
      insertCategory.run(name, slug, type);
      row = getCategoryIdBySlug.get(slug);
    } else {
      db.prepare('UPDATE categories SET type = ? WHERE id = ?').run(type, row.id);
    }
    return row.id;
  };

  const manRootId = ensureRoot('Производители', 'manufacturers', 'root');
  const typeRootId = ensureRoot('Типы оборудования', 'equipment-types', 'root');

  // Связываем корни с соответствующими категориями
  const mans = db.prepare("SELECT id FROM categories WHERE type = 'manufacturer' AND name != 'Производители'").all();
  const eqs = db.prepare("SELECT id FROM categories WHERE type = 'equipment-type' AND name != 'Типы оборудования'").all();

  for (const m of mans) insertPath.run(manRootId, m.id, 1);
  for (const e of eqs) insertPath.run(typeRootId, e.id, 1);

  console.log('Готово!');
  console.log(`Связей: ${db.prepare('SELECT COUNT(*) as cnt FROM category_paths WHERE depth > 0').get().cnt}`);
})();