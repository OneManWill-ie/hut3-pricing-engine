import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/store.db';

// Make sure the folder exists (matters the first time a container starts)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit_price_pence INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY,
    amount_off_pence INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    config TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    session_uuid TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);


// --- Seed data, only inserted once (idempotent: checks if table is empty) ---
const seedIfEmpty = (table, rows, insertSql) => {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  if (count === 0) {
    const insert = db.prepare(insertSql);
    const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
    insertMany(rows);
    console.log(`Seeded ${rows.length} row(s) into ${table}`);
  }
};

seedIfEmpty(
  'items',
  [
    { name: 'Wireless Mouse', unit_price_pence: 1999 },
    { name: 'USB-C Cable', unit_price_pence: 799 },
    { name: 'Mechanical Keyboard', unit_price_pence: 5499 },
  ],
  'INSERT INTO items (name, unit_price_pence) VALUES (@name, @unit_price_pence)'
);

seedIfEmpty(
  'cart_items',
  [
    { item_id: 1, quantity: 2 },
    { item_id: 2, quantity: 3 },
    { item_id: 3, quantity: 1 },
  ],
  'INSERT INTO cart_items (item_id, quantity) VALUES (@item_id, @quantity)'
);

seedIfEmpty(
  'coupons',
  [
    { code: 'SAVE5', amount_off_pence: 500 },
    { code: 'WELCOME10', amount_off_pence: 1000 },
  ],
  'INSERT INTO coupons (code, amount_off_pence) VALUES (@code, @amount_off_pence)'
);

seedIfEmpty(
  'users',
  [{ username: 'admin', password: 'admin123' }],
  'INSERT INTO users (username, password) VALUES (@username, @password)'
);

seedIfEmpty(
  'rules',
  [
    {
      type: 'bxgy',
      config: JSON.stringify({ item_name: 'USB-C Cable', buy_quantity: 3, free_quantity: 1 }),
    },
    {
      type: 'percent',
      config: JSON.stringify({ threshold_pence: 5000, percent_off: 10 }),
    },
  ],
  'INSERT INTO rules (type, config) VALUES (@type, @config)'
);
