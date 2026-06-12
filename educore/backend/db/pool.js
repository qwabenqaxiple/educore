// db/pool.js — Dual PostgreSQL connection pool (Live + Demo)
const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

// ─── Demo email list ──────────────────────────────────────────────────────────
const DEMO_EMAILS = [
  'admin@educore.edu',
  'teacher@educore.edu',
  'student@educore.edu',
  'parent@educore.edu',
];

// ─── Helper: build pool config from a connection string or env vars ───────────
function makePool(connectionString, label) {
  const pool = connectionString
    ? new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      })
    : new Pool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'educore',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ssl: false,
      });

  pool.on('error', (err) => {
    console.error(`[${label} pool] Unexpected error on idle client`, err);
  });

  return pool;
}

// ─── Pools ────────────────────────────────────────────────────────────────────
const livePool = makePool(process.env.DATABASE_URL,      'LIVE');
const demoPool = makePool(process.env.DEMO_DATABASE_URL, 'DEMO');

// ─── AsyncLocalStorage for per-request pool routing ──────────────────────────
const storage = new AsyncLocalStorage();

/**
 * Run a callback with the demo or live pool set as the current context.
 * Any call to query() inside that callback (and all functions it calls)
 * will automatically use the correct pool — no route changes needed.
 */
const setDbContext = (type, callback) => {
  const pool = type === 'demo' ? demoPool : livePool;
  return storage.run(pool, callback);
};

// ─── Unified query helper — picks pool from context ──────────────────────────
const query = (text, params) => {
  const pool = storage.getStore() || livePool;
  return pool.query(text, params);
};

// ─── Client helper (for transactions) ────────────────────────────────────────
const getClient = () => {
  const pool = storage.getStore() || livePool;
  return pool.connect();
};

// ─── Direct pool references (used by seed endpoint & server startup) ──────────
module.exports = {
  pool: livePool,       // live pool (default, used by server.js startup)
  livePool,
  demoPool,
  query,
  getClient,
  setDbContext,
  DEMO_EMAILS,
};
