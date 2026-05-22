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

module.exports = router;
