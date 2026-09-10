import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { priceCart } from './pricing.js';

const app = express();
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-session-uuid'],
  })
);
app.use(express.json());

const requireSession = (req, res, next) => {
  const sessionUuid = req.get('x-session-uuid');

  if (!sessionUuid) {
    return res.status(401).json({ error: 'Missing session' });
  }

  const session = db
    .prepare(
      'SELECT * FROM sessions WHERE session_uuid = ? AND expires_at > ?'
    )
    .get(sessionUuid, Date.now());

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(session.user_id);
  next();
};

// --- GET /api/cart -----------------------------------------------------
// Returns the persisted cart as-is (no pricing).
app.get('/api/cart', (req, res) => {
  const items = db
    .prepare(`
      SELECT cart_items.id, cart_items.item_id, items.name, items.unit_price_pence, cart_items.quantity
      FROM cart_items
      JOIN items ON items.id = cart_items.item_id
      ORDER BY cart_items.id
    `)
    .all();
  res.json(items);
});

// --- GET /api/items -----------------------------------------------------
app.get('/api/items', (req, res) => {
  res.json(db.prepare('SELECT * FROM items ORDER BY id').all());
});

// --- POST /api/login -----------------------------------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = db
    .prepare('SELECT id, username FROM users WHERE username = ? AND password = ?')
    .get(username.trim(), password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const sessionUuid = randomUUID();
  const now = Date.now();

  db.prepare(
    'INSERT INTO sessions (user_id, session_uuid, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(user.id, sessionUuid, now, now + 1000 * 60 * 60 * 24);

  res.json({
    session_uuid: sessionUuid,
    user: { id: user.id, username: user.username },
  });
});

// --- POST /api/cart ------------------------------------------------------
// Add a line item to the cart. Body: { item_id, quantity }
app.post('/api/cart', requireSession, (req, res) => {
  const { item_id, quantity } = req.body;

  if (!Number.isInteger(item_id) || item_id <= 0) {
    return res.status(400).json({ error: 'item_id must be a positive integer' });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }

  if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(item_id)) {
    return res.status(404).json({ error: `Unknown item id ${item_id}` });
  }

  const { lastInsertRowid } = db
    .prepare('INSERT INTO cart_items (item_id, quantity) VALUES (?, ?)')
    .run(item_id, quantity);

  res.status(201).json(
    db
      .prepare(`
        SELECT cart_items.id, cart_items.item_id, items.name, items.unit_price_pence, cart_items.quantity
        FROM cart_items
        JOIN items ON items.id = cart_items.item_id
        WHERE cart_items.id = ?
      `)
      .get(lastInsertRowid)
  );
});

// --- PATCH /api/cart/:id --------------------------------------------------
// Update the quantity for an existing cart line. Body: { quantity }
app.patch('/api/cart/:id', requireSession, (req, res) => {
  const { quantity } = req.body;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive integer' });
  }

  const result = db
    .prepare('UPDATE cart_items SET quantity = ? WHERE id = ?')
    .run(quantity, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: `Unknown cart item id ${req.params.id}` });
  }

  res.json(
    db
      .prepare(`
        SELECT cart_items.id, cart_items.item_id, items.name, items.unit_price_pence, cart_items.quantity
        FROM cart_items
        JOIN items ON items.id = cart_items.item_id
        WHERE cart_items.id = ?
      `)
      .get(req.params.id)
  );
});

// --- DELETE /api/cart/:id -------------------------------------------------
app.delete('/api/cart/:id', requireSession, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- POST /api/price -------------------------------------------------------
// Prices the current persisted cart, optionally applying a coupon code.
// Body: { coupon_code?: string }
app.post('/api/price', (req, res) => {
  const { coupon_code } = req.body || {};

  const cartItems = db
    .prepare(`
      SELECT cart_items.id, cart_items.item_id, items.name, items.unit_price_pence, cart_items.quantity
      FROM cart_items
      JOIN items ON items.id = cart_items.item_id
      ORDER BY cart_items.id
    `)
    .all();

  // Edge case: negative/zero quantity rows shouldn't be priced as if real.
  const validItems = cartItems.filter((i) => i.quantity > 0);

  const rules = db
    .prepare('SELECT type, config FROM rules ORDER BY id')
    .all()
    .map(({ type, config }) => ({ type, ...JSON.parse(config) }));

  let coupon = null;
  let coupon_error = null;
  if (coupon_code) {
    coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(coupon_code.trim().toUpperCase());
    if (!coupon) coupon_error = `Unknown coupon code "${coupon_code}"`;
  }

  const result = priceCart(validItems, { rules, coupon });

  res.json({ ...result, coupon_applied: coupon?.code ?? null, coupon_error });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Pricing API listening on :${PORT}`));
