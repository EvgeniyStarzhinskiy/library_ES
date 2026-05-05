const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDB() {
  db = new Database(path.join(__dirname, 'library.db'));
  
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Таблицы
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      display_name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      oauth_provider TEXT,
      oauth_id TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      email_verified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      type TEXT,
      background_image TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS category_paths (
      ancestor_id INTEGER REFERENCES categories(id),
      descendant_id INTEGER REFERENCES categories(id),
      depth INTEGER,
      PRIMARY KEY (ancestor_id, descendant_id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      year INTEGER,
      theme TEXT,
      publisher TEXT,
      pages INTEGER,
      description TEXT,
      file_type TEXT NOT NULL,
      cloud_path TEXT NOT NULL,
      preview_cloud_path TEXT,
      hls_url TEXT,
      file_size INTEGER,
      is_published INTEGER DEFAULT 1,
      version_of_id INTEGER REFERENCES documents(id),
      current_version_id INTEGER REFERENCES documents(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      uploaded_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_tag (
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS document_category (
      document_id INTEGER REFERENCES documents(id),
      category_id INTEGER REFERENCES categories(id),
      PRIMARY KEY (document_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, document_id)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      user_id INTEGER REFERENCES users(id),
      document_id INTEGER REFERENCES documents(id),
      stars INTEGER CHECK(stars BETWEEN 1 AND 5),
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, document_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      document_id INTEGER REFERENCES documents(id),
      parent_id INTEGER REFERENCES comments(id),
      content TEXT NOT NULL,
      is_moderated INTEGER DEFAULT 0,
      complaint_flag INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      amount REAL,
      transaction_id TEXT,
      donated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}

function getDB() {
  return db;
}

module.exports = { initDB, getDB };