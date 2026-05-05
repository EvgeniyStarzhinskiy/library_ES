const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database('db/library.db');

const data = JSON.parse(fs.readFileSync('/home/nodejs/library/library.json', 'utf8'));

const getCatId = db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?');
const insertPath = db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)');

// Из by_manufacturer: производитель -> типы
for (const [manName, typesObj] of Object.entries(data.hierarchies.by_manufacturer)) {
  const manRow = getCatId.get(manName, 'manufacturer');
  if (!manRow) { console.log(`Не найден производитель: ${manName}`); continue; }
  for (const typeName of Object.keys(typesObj)) {
    const typeRow = getCatId.get(typeName, 'equipment-type');
    if (!typeRow) { console.log(`Не найден тип оборудования: ${typeName}`); continue; }
    insertPath.run(manRow.id, typeRow.id, 1);
  }
}

// Из by_type: тип -> производители
for (const [typeName, mansObj] of Object.entries(data.hierarchies.by_type)) {
  const typeRow = getCatId.get(typeName, 'equipment-type');
  if (!typeRow) { console.log(`Не найден тип оборудования: ${typeName}`); continue; }
  for (const manName of Object.keys(mansObj)) {
    const manRow = getCatId.get(manName, 'manufacturer');
    if (!manRow) { console.log(`Не найден производитель: ${manName}`); continue; }
    insertPath.run(typeRow.id, manRow.id, 1);
  }
}

console.log('Готово! Связи добавлены.');