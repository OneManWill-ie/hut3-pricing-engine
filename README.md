# Pricing & Discount Engine

A small full-stack cart pricing app: Node.js/Express API, SQLite, React (Vite) frontend.

## Running it

```
docker compose up --build
```

- API: http://localhost:4000
- UI: http://localhost:5173

The database is a SQLite file in a Docker volume, seeded automatically on first boot
(see `backend/src/db.js`) with a sample cart, a couple of coupon codes (`SAVE5`, `WELCOME10`),
one BXGY rule (buy 3 USB-C Cables, get 1 free), and one percentage rule (10% off carts over £50).

Running without Docker: `cd backend && npm install && npm run dev`, then
`cd frontend && npm install && npm run dev`.

## Database

Rules live in their own tables so a new rule of an existing
type can be added via a DB row, and `pricing.js` is written so a new rule type only needs
a new branch there, not a rewrite of the others.

## Current discount ordering

1. BOGOF first as it changes how many units are actually being paid for, which everything
   else should be calculated from.
2. Percentage off coupons.
3. Flat coupon last, off whatever's left.
4. Clamp at £0 — a coupon or discount can never push the total negative.


## Planned

- Move rule types to a single `rules` table with a `type` + JSON `config` column, so adding
  a rule type doesn't need a new table/migration.
- Basic auth on the write endpoints (`POST/DELETE /api/cart`).
- Some unit tests for `pricing.js`.
- Go through and double check AI generated dependency versions.

## AI-tool notes

- Generated initial project structure and dockerfiles, but in the backend it used an image base that's securty was expired, so I needed to change that.
