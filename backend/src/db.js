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

  -- "Buy X of item, get Y free" rules. Kept in its own table so a new rule
  -- can be added later without touching existing rows or code paths.
  CREATE TABLE IF NOT EXISTS bxgy_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    buy_quantity INTEGER NOT NULL,
    free_quantity INTEGER NOT NULL
  );

  -- Percentage-off-whole-cart rules, gated by a subtotal threshold.
  CREATE TABLE IF NOT EXISTS percent_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threshold_pence INTEGER NOT NULL,
    percent_off REAL NOT NULL
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
  'bxgy_rules',
  [{ item_name: 'USB-C Cable', buy_quantity: 3, free_quantity: 1 }],
  'INSERT INTO bxgy_rules (item_name, buy_quantity, free_quantity) VALUES (@item_name, @buy_quantity, @free_quantity)'
);

seedIfEmpty(
  'percent_rules',
  [{ threshold_pence: 5000, percent_off: 10 }],
  'INSERT INTO percent_rules (threshold_pence, percent_off) VALUES (@threshold_pence, @percent_off)'
);
