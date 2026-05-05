const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('db/library.db');

const JSON_PATH = '/home/nodejs/library/library.json';

if (!fs.existsSync(JSON_PATH)) {
  console.error('library.json не найден');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// Очистим старые связи
db.exec('DELETE FROM document_category');

// Подготовленные запросы
const getDocId = db.prepare('SELECT id FROM documents WHERE source_path = ?');
const getCatByNameType = db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?');
const insertLink = db.prepare('INSERT OR IGNORE INTO document_category (document_id, category_id) VALUES (?, ?)');

// Определяем тип категории по имени
function detectType(name) {
  const n = name.toLowerCase();
  if (['производители', 'manufacturers'].includes(n)) return 'root';
  if (['типы оборудования', 'equipment-types'].includes(n)) return 'root';
  if (['акрос', 'derrick', 'mi swaco', 'brandt', 'kem-tron', 'scomi'].includes(n)) return 'manufacturer';
  if (['вибросита', 'центрифуги', 'гидроциклоны', 'дегазаторы', 'центробежные насосы', 'винтовые насосы', 'конвейеры', 'смесительное', 'verti-g', 'ёмкости', 'пво', 'вертлюги', 'приводы и двигатели', 'предохранительные муфты', 'ситовые панели'].includes(n)) return 'equipment-type';
  return 'imported';
}

// Рекурсивно собирает все конечные категории (где массив) для документа с sourcePath
function findCategoriesForDocument(node, sourcePath, categoriesList = []) {
  if (!node || typeof node !== 'object') return categoriesList;

  for (const [key, content] of Object.entries(node)) {
    if (Array.isArray(content)) {
      // Проверяем, есть ли документ в этом массиве
      const doc = content.find(d => d.path === sourcePath);
      if (doc) {
        const catType = detectType(key);
        const catId = getCatByNameType.get(key, catType);
        if (catId) categoriesList.push(catId.id);
      }
    } else if (typeof content === 'object' && content !== null) {
      findCategoriesForDocument(content, sourcePath, categoriesList);
    }
  }
  return categoriesList;
}

// Основной процесс: проходим по всем документам из базы
const allDocs = db.prepare('SELECT id, source_path FROM documents WHERE source_path IS NOT NULL').all();
let totalLinked = 0;
let totalSkipped = 0;

for (const doc of allDocs) {
  const categories = [];

  // Ищем в by_type
  if (data.hierarchies.by_type) {
    const cats = findCategoriesForDocument(data.hierarchies.by_type, doc.source_path, []);
    categories.push(...cats);
  }

  // Ищем в by_manufacturer
  if (data.hierarchies.by_manufacturer) {
    const cats = findCategoriesForDocument(data.hierarchies.by_manufacturer, doc.source_path, []);
    categories.push(...cats);
  }

  // Убираем дубликаты
  const uniqueCategories = [...new Set(categories)];

  if (uniqueCategories.length === 0) {
    totalSkipped++;
    continue;
  }

  for (const catId of uniqueCategories) {
    insertLink.run(doc.id, catId);
    totalLinked++;
  }
}

console.log(`Готово! Привязано связей: ${totalLinked}, пропущено документов: ${totalSkipped}`);