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

// Пройти по by_manufacturer: Manufacturer -> EquipmentType (depth=1)
function addManufacturerToType(node) {
  if (!node || typeof node !== 'object') return;
  for (const [manName, typesObj] of Object.entries(node)) {
    const manRow = getCatByNameType.get(manName, 'manufacturer');
    if (!manRow) continue;
    if (typeof typesObj === 'object') {
      for (const [typeName, sub] of Object.entries(typesObj)) {
        const typeRow = getCatByNameType.get(typeName, 'equipment-type');
        if (!typeRow) continue;
        insertPath.run(manRow.id, typeRow.id, 1);
        // Глубже не идём — там уже модели
      }
    }
  }
}

// Пройти по by_type: EquipmentType -> Manufacturer (depth=1)
function addTypeToManufacturer(node) {
  if (!node || typeof node !== 'object') return;
  for (const [typeName, mansObj] of Object.entries(node)) {
    const typeRow = getCatByNameType.get(typeName, 'equipment-type');
    if (!typeRow) continue;
    if (typeof mansObj === 'object') {
      for (const [manName, sub] of Object.entries(mansObj)) {
        const manRow = getCatByNameType.get(manName, 'manufacturer');
        if (!manRow) continue;
        insertPath.run(typeRow.id, manRow.id, 1);
      }
    }
  }
}

console.log('Добавляю связи Производитель -> Тип...');
addManufacturerToType(data.hierarchies.by_manufacturer);

console.log('Добавляю связи Тип -> Производитель...');
addTypeToManufacturer(data.hierarchies.by_type);

console.log('Готово! Проверьте категорию Derrick.');