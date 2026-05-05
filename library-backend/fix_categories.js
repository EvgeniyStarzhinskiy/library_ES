const Database = require('better-sqlite3');
const db = new Database('db/library.db');

// ======= 1. Исправляем типы для известных категорий =======
const typeFixes = {
  'акрос': 'manufacturer',
  'derrick': 'manufacturer',
  'mi swaco': 'manufacturer',
  'brandt': 'manufacturer',
  'kem-tron': 'manufacturer',
  'scomi': 'manufacturer',
  'вибросита': 'equipment-type',
  'центрифуги': 'equipment-type',
  'гидроциклоны': 'equipment-type',
  'дегазаторы': 'equipment-type',
  'центробежные насосы': 'equipment-type',
  'винтовые насосы': 'equipment-type',
  'конвейеры': 'equipment-type',
  'смесительное': 'equipment-type',
  'verti-g': 'equipment-type',
  'ёмкости': 'equipment-type',
  'пво': 'equipment-type',
  'вертлюги': 'equipment-type',
  'приводы и двигатели': 'equipment-type',
  'предохранительные муфты': 'equipment-type',
  'ситовые панели': 'equipment-type'
};

const updateType = db.prepare('UPDATE categories SET type = ? WHERE name = ?');
for (const [name, type] of Object.entries(typeFixes)) {
  updateType.run(type, name);
}
console.log('Типы категорий обновлены.');

// ======= 2. Создаём / находим корневые узлы =======
function ensureRoot(name, slug, type) {
  let row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
  if (!row) {
    db.prepare('INSERT INTO categories (name, slug, type) VALUES (?, ?, ?)').run(name, slug, type);
    row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
  } else {
    db.prepare('UPDATE categories SET type = ? WHERE id = ?').run(type, row.id);
  }
  return row.id;
}

const manufacturersRootId = ensureRoot('Производители', 'manufacturers', 'root');
const typesRootId = ensureRoot('Типы оборудования', 'equipment-types', 'root');

// ======= 3. Добавляем связи от корней к дочерним категориям =======
const insertPath = db.prepare('INSERT OR IGNORE INTO category_paths (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)');

// Производители -> все производители
const manufacturers = db.prepare("SELECT id FROM categories WHERE type = 'manufacturer'").all();
for (const m of manufacturers) {
  insertPath.run(manufacturersRootId, m.id, 1);
}

// Типы оборудования -> все типы
const equipmentTypes = db.prepare("SELECT id FROM categories WHERE type = 'equipment-type'").all();
for (const et of equipmentTypes) {
  insertPath.run(typesRootId, et.id, 1);
}

// ======= 4. Связи между производителями и типами из library.json (by_manufacturer) уже должны были быть созданы,
// но если их нет, добавим принудительно основные.
// Для быстрой проверки добавим некоторые связи напрямую (можно расширить):
const crossLinks = [
  ['derrick', 'вибросита'],
  ['derrick', 'центрифуги'],
  ['derrick', 'гидроциклоны'],
  ['mi swaco', 'вибросита'],
  ['mi swaco', 'центрифуги'],
  ['brandt', 'вибросита'],
  ['kem-tron', 'центрифуги'],
  ['акрос', 'вибросита'],
  ['акрос', 'центрифуги'],
  ['акрос', 'гидроциклоны'],
  ['scomi', 'центрифуги']
];

const getCatId = db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?');
for (const [manName, equipName] of crossLinks) {
  const man = getCatId.get(manName, 'manufacturer');
  const equip = getCatId.get(equipName, 'equipment-type');
  if (man && equip) {
    insertPath.run(man.id, equip.id, 1);
  }
}

console.log('Связи заполнены.');
console.log('Готово!');