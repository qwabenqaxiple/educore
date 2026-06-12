// server.js — EduCore SMS API Server
require('./loadEnv');
const fs       = require('fs');
const path     = require('path');
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const frontendOrigin = (() => {
  try {
    return new URL(frontendUrl).origin;
  } catch {
    return frontendUrl.replace(/\/+$/, '');
  }
})();

app.use(cors({
  origin: frontendOrigin,
  credentials: true,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // standard defense against brute force on sensitive actions
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

app.use('/api', rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 1000, // generous limit to support hot reloading and frequent page refreshes
}));

// ─── Body Parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/students',      require('./routes/students'));
app.use('/api/teachers',      require('./routes/teachers'));
app.use('/api/classes',       require('./routes/classes'));
app.use('/api/subjects',      require('./routes/subjects'));
app.use('/api/attendance',    require('./routes/attendance'));
app.use('/api/exams',         require('./routes/exams'));
app.use('/api/fees',          require('./routes/fees'));
app.use('/api/timetable',     require('./routes/timetable'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/reports',       require('./routes/reports'));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ─── 404 & Error Handlers ────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 EduCore API running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Health check: http://localhost:${PORT}/health\n`);

    // Startup database schema and migrations for session logging & notifications
    const { query: liveQuery, demoPool } = require('./db/pool');
    const schemaFile = path.join(__dirname, 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaFile, 'utf8');

    async function runMigrations(queryFn, label) {
      const statements = schemaSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`[${label} Migrations] Found ${statements.length} statements.`);

      for (const statement of statements) {
        const cleanStmt = statement.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
        if (!cleanStmt) continue;
        try {
          await queryFn(statement);
        } catch (err) {
          if (cleanStmt.toUpperCase().startsWith('CREATE EXTENSION')) {
            console.warn(`[${label} Migrations] WARNING: ${err.message}`);
          } else {
            console.error(`[${label} Migrations] ERROR: ${cleanStmt}\n${err.message}`);
            throw err;
          }
        }
      }

      await queryFn(`CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(120) NOT NULL,
        role VARCHAR(20) NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        login_time TIMESTAMPTZ DEFAULT NOW()
      )`);
      await queryFn('CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id)');
      await queryFn('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id INT REFERENCES users(id) ON DELETE SET NULL');
      try {
        await queryFn('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        await queryFn("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('Super Admin', 'Admin', 'Teacher', 'Student', 'Parent'))");
      } catch (err) {
        console.error(`[${label} Migrations] Warning: could not update role check constraint: ${err.message}`);
      }
      console.log(`[${label} Migrations] Completed successfully!`);
    }

    const demoQuery = (text, params) => demoPool.query(text, params);

    // Run migrations on both databases in parallel
    Promise.all([
      runMigrations(liveQuery, 'LIVE'),
      runMigrations(demoQuery, 'DEMO'),
    ]).catch(err => console.error('Error running startup migrations:', err));
  });
}

module.exports = app;
