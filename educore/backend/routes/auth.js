// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const sign = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    const { email, password } = req.body;

    // Block demo accounts in production mode
    const demoEmails = ['admin@educore.edu', 'teacher@educore.edu', 'student@educore.edu', 'parent@educore.edu'];
    if (process.env.APP_ENV === 'production' && demoEmails.includes(email?.toLowerCase())) {
      return res.status(401).json({ error: 'Demo accounts are disabled in production mode' });
    }

    const { rows } = await query(
      'SELECT id,name,email,password,role,phone,avatar FROM users WHERE email=$1',
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    delete user.password;

    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';
      await query(
        'INSERT INTO login_logs (user_id, email, role, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [user.id, user.email, user.role, ip, userAgent]
      );
    } catch (logErr) {
      console.error('Failed to write login log:', logErr);
    }

    res.json({ token: sign(user), user });
  }
);

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register',
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['Admin','Teacher','Student','Parent']),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    const { name, email, password, role, phone } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const avatar = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();

    try {
      const { rows } = await query(
        `INSERT INTO users (name,email,password,role,phone,avatar)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role,phone,avatar`,
        [name, email, hash, role, phone, avatar]
      );
      const user = rows[0];
      res.status(201).json({ token: sign(user), user });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
      throw err;
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ─── PUT /api/auth/password ────────────────────────────────────────────────────
router.put('/password', authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { rows } = await query('SELECT password FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  }
);
// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
    
    // Simulate processing the password reset request
    res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
  }
);

// ─── GET /api/auth/config ──────────────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({ appEnv: process.env.APP_ENV || 'development' });
});

// ─── POST /api/auth/seed-production ───────────────────────────────────────────
// Secure one-time seeder endpoint — protected by x-seed-key header
router.post('/seed-production', async (req, res) => {
  const SEED_KEY = process.env.SEED_SECRET_KEY || 'xiple-seed-2024';
  const providedKey = req.headers['x-seed-key'];

  if (providedKey !== SEED_KEY) {
    return res.status(403).json({ error: 'Forbidden: invalid seed key' });
  }

  try {
    const bcrypt = require('bcryptjs');
    const fs = require('fs');
    const path = require('path');

    // Drop and rebuild schema
    await query(`
      DROP TABLE IF EXISTS login_logs CASCADE;
      DROP TABLE IF EXISTS timetable CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS fees CASCADE;
      DROP TABLE IF EXISTS results CASCADE;
      DROP TABLE IF EXISTS exams CASCADE;
      DROP TABLE IF EXISTS attendance CASCADE;
      DROP TABLE IF EXISTS teacher_classes CASCADE;
      DROP TABLE IF EXISTS teacher_subjects CASCADE;
      DROP TABLE IF EXISTS teachers CASCADE;
      DROP TABLE IF EXISTS students CASCADE;
      DROP TABLE IF EXISTS subject_classes CASCADE;
      DROP TABLE IF EXISTS subjects CASCADE;
      DROP TABLE IF EXISTS classes CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
    // Run schema statements one by one
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try { await query(stmt); } catch (e) { /* ignore extension errors */ }
    }

    // Run incremental migrations
    await query(`CREATE TABLE IF NOT EXISTS login_logs (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(120) NOT NULL,
      role VARCHAR(20) NOT NULL,
      ip_address VARCHAR(50),
      user_agent TEXT,
      login_time TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query('CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id)');
    await query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id INT REFERENCES users(id) ON DELETE SET NULL');

    // Seed only the live admin account
    const hash = await bcrypt.hash('xiple@2020', 10);
    await query(
      `INSERT INTO users (name, email, password, role, phone, avatar)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET password=$3`,
      ['Tei Ezekiel', 'teiezekiel131@gmail.com', hash, 'Admin', '055-000-0000', 'TE']
    );

    return res.json({
      success: true,
      message: '✅ Production database seeded successfully!',
      admin: 'teiezekiel131@gmail.com',
    });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ error: 'Seeding failed: ' + err.message });
  }
});

module.exports = router;
