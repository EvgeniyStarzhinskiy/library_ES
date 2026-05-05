const Database = require('better-sqlite3');
const db = new Database('db/library.db');

// Создаём виртуальную таблицу, если её нет
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    title,
    description,
    author,
    theme,
    publisher,
    content='documents',
    content_rowid='id'
  );
`);

// Заполняем индекс существующими документами
db.exec(`
  INSERT INTO documents_fts(rowid, title, description, author, theme, publisher)
  SELECT id, title, description, author, theme, publisher FROM documents
  WHERE id NOT IN (SELECT rowid FROM documents_fts);
`);

console.log('FTS5 индекс готов. Документов проиндексировано:');
console.log(db.prepare('SELECT COUNT(*) as cnt FROM documents_fts').get().cnt);