const Database = require('better-sqlite3');
const db = new Database('db/library.db');

// Приводим имена производителей и типов к капитализации (первая буква большая, остальные маленькие)
function normalizeName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// Обновляем названия для типов manufacturer и equipment-type
const updateName = db.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?');
const getAll = db.prepare("SELECT id, name, slug, type FROM categories WHERE type IN ('manufacturer','equipment-type')").all();

for (const cat of getAll) {
  const newName = normalizeName(cat.name);
  const newSlug = newName.toLowerCase().replace(/ /g, '-');
  if (cat.name !== newName || cat.slug !== newSlug) {
    updateName.run(newName, newSlug, cat.id);
  }
}

// Удаляем дубликаты (оставляем категорию с минимальным id)
const findDupes = db.prepare("SELECT name, type, COUNT(*) as cnt, MIN(id) as minId FROM categories GROUP BY name, type HAVING cnt > 1").all();
const deleteCat = db.prepare('DELETE FROM categories WHERE id = ?');
const deletePaths = db.prepare('DELETE FROM category_paths WHERE ancestor_id = ? OR descendant_id = ?');
const deleteDocCat = db.prepare('DELETE FROM document_category WHERE category_id = ?');

for (const dup of findDupes) {
  const dupes = db.prepare("SELECT id FROM categories WHERE name = ? AND type = ? AND id != ?").all(dup.name, dup.type, dup.minId);
  for (const d of dupes) {
    // Переносим связи document_category на минимальный id
    db.prepare('UPDATE IGNORE document_category SET category_id = ? WHERE category_id = ?').run(dup.minId, d.id);
    deleteDocCat.run(d.id);
    // Удаляем пути
    deletePaths.run(d.id);
    deletePaths.run(d.id);
    // Удаляем саму категорию
    deleteCat.run(d.id);
  }
}

console.log('Нормализация завершена. Запустите build_links.js заново.');