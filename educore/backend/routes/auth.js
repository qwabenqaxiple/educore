// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query, setDbContext, DEMO_EMAILS, livePool, demoPool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// Include email in payload so auth middleware can pick the right DB on subsequent requests
const sign = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, email: user.email },
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

    if (process.env.APP_ENV === 'production' && DEMO_EMAILS.includes(email.toLowerCase())) {
      return res.status(401).json({ error: 'Demo accounts are disabled in production mode' });
    }

    // Route to the correct database based on whether it's a demo email
    const dbType = DEMO_EMAILS.includes(email.toLowerCase()) ? 'demo' : 'live';

    let user;
    await setDbContext(dbType, async () => {
      const { rows } = await query(
        'SELECT id,name,email,password,role,phone,avatar FROM users WHERE email=$1',
        [email]
      );
      if (!rows.length) return; // handled below
      const valid = await bcrypt.compare(password, rows[0].password);
      if (!valid) return; // handled below
      user = rows[0];

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
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    delete user.password;
    res.json({ token: sign(user), user });
  }
);

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register',
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['Super Admin','Admin','Teacher','Student','Parent']),
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
  res.json({ user: { ...req.user, dbType: req.dbType } });
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

    const { email } = req.body;
    const dbType = DEMO_EMAILS.includes(email.toLowerCase()) ? 'demo' : 'live';

    try {
      let userExists = false;
      let userId = null;

      await setDbContext(dbType, async () => {
        const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (rows.length > 0) {
          userExists = true;
          userId = rows[0].id;
        }
      });

      if (userExists) {
        // Generate token valid for 1 hour
        const resetToken = jwt.sign(
          { id: userId, email: email, dbType: dbType, purpose: 'password-reset' },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        // We construct the frontend URL, appending the token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = `${frontendUrl}/?resetToken=${resetToken}`;

        const { sendEmail } = require('../middleware/notify');
        await sendEmail({
          to: email,
          subject: 'Reset Your EduCore Password',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0">
              <h2 style="color:#1d4ed8;margin-bottom:16px">🔑 EduCore Password Reset</h2>
              <p>Hello,</p>
              <p>We received a request to reset the password for your EduCore School Management System account.</p>
              <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
              <div style="text-align:center;margin:32px 0">
                <a href="${resetLink}" style="background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Reset Password</a>
              </div>
              <p style="color:#64748b;font-size:13px">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="color:#1d4ed8;font-size:13px;word-break:break-all">${resetLink}</p>
              <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0" />
              <p style="color:#64748b;font-size:12px">If you did not request a password reset, you can safely ignore this email.</p>
              <p style="color:#64748b;font-size:12px">EduCore School Management System</p>
            </div>
          `
        });
      }

      // Return generic message to prevent user enumeration
      res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Failed to process forgot password request' });
    }
  }
);

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password',
  body('token').notEmpty(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    const { token, password } = req.body;

    try {
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(400).json({ error: 'Password reset link is invalid or has expired' });
      }

      if (decoded.purpose !== 'password-reset') {
        return res.status(400).json({ error: 'Invalid token purpose' });
      }

      const hash = await bcrypt.hash(password, 10);

      await setDbContext(decoded.dbType, async () => {
        await query('UPDATE users SET password = $1 WHERE id = $2 AND email = $3', [hash, decoded.id, decoded.email]);
      });

      res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Failed to reset password' });
    }
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

  async function seedDatabase(dbType) {
    await setDbContext(dbType, async () => {
      // 1. Drop existing tables
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

      // 2. Read schema and execute statements
      const fs = require('fs');
      const path = require('path');
      const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
      const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        const cleanStmt = stmt.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
        if (!cleanStmt) continue;
        try {
          await query(stmt);
        } catch (e) {
          if (!cleanStmt.toUpperCase().startsWith('CREATE EXTENSION')) {
            throw e;
          }
        }
      }

      // Incremental migrations/additional tables
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

      // 3. Seed Users
      const liveAdmin = { name: 'Tei Ezekiel', email: 'teiezekiel131@gmail.com', password: 'xiple@2020', role: 'Super Admin', phone: '055-000-0000', avatar: 'TE' };
      const demoUsers = [
        { name: 'Dr. Ezekiel Tei',  email: 'admin@educore.edu',       password: 'admin123',   role: 'Admin',   phone: '055-000-0001', avatar: 'TE' },
        { name: 'Mrs. Efua Mensah', email: 'teacher@educore.edu',     password: 'teach123',   role: 'Teacher', phone: '055-000-0002', avatar: 'EM' },
        { name: 'Kofi Boateng',     email: 'student@educore.edu',     password: 'stud123',    role: 'Student', phone: '055-000-0003', avatar: 'KB' },
        { name: 'Mrs. Ama Boateng', email: 'parent@educore.edu',      password: 'par123',     role: 'Parent',  phone: '055-000-0004', avatar: 'AB' },
      ];

      const usersToSeed = dbType === 'demo' ? [liveAdmin, ...demoUsers] : [liveAdmin];
      for (const u of usersToSeed) {
        const hash = await bcrypt.hash(u.password, 10);
        await query(
          `INSERT INTO users (name, email, password, role, phone, avatar)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE SET password=$3, role=$4`,
          [u.name, u.email, hash, u.role, u.phone, u.avatar]
        );
      }

      // Only seed the rest of the demo data for the 'demo' database
      if (dbType === 'demo') {
        // Classes
        const CLASSES = [
          { name: 'Form 1A', level: 'JHS', capacity: 40 },
          { name: 'Form 2B', level: 'JHS', capacity: 38 },
          { name: 'Form 3A', level: 'JHS', capacity: 35 },
        ];
        for (const c of CLASSES) {
          await query(
            `INSERT INTO classes (name,level,capacity) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [c.name, c.level, c.capacity]
          );
        }

        // Subjects
        const SUBJECTS = [
          { name: 'Mathematics', code: 'MATH' },
          { name: 'English Language', code: 'ENG' },
          { name: 'Integrated Science', code: 'SCI' },
          { name: 'Social Studies', code: 'SOC' },
          { name: 'ICT', code: 'ICT' },
        ];
        for (const s of SUBJECTS) {
          await query(
            `INSERT INTO subjects (name,code) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`,
            [s.name, s.code]
          );
        }

        // Teachers
        const TEACHERS = [
          { staffId: 'TCH-001', name: 'Mrs. Efua Mensah', email: 'teacher@educore.edu', phone: '055-000-0002', gender: 'Female', qualification: 'B.Ed Mathematics' },
          { staffId: 'TCH-002', name: 'Mr. Ebo Quansah', email: 'equansah@educore.edu', phone: '055-333-002', gender: 'Male', qualification: 'B.Sc Science' },
          { staffId: 'TCH-003', name: 'Ms. Abena Frimpong', email: 'afrimpong@educore.edu', phone: '055-333-003', gender: 'Female', qualification: 'B.A Social Studies' },
        ];
        for (const t of TEACHERS) {
          await query(
            `INSERT INTO teachers (staff_id,name,email,phone,gender,qualification)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
            [t.staffId, t.name, t.email, t.phone, t.gender, t.qualification]
          );
        }

        // Students
        const { rows: cls } = await query('SELECT id,name FROM classes');
        const clsMap = Object.fromEntries(cls.map(c => [c.name, c.id]));

        const STUDENTS = [
          { sid: 'STU-001', name: 'Kofi Boateng', cls: 'Form 1A', age: 14, gender: 'Male', phone: '055-111-001', guardian: 'Mrs. Ama Boateng', gPhone: '055-000-0004', addr: 'Accra', dob: '2012-05-15' },
          { sid: 'STU-002', name: 'Akosua Darko', cls: 'Form 1A', age: 13, gender: 'Female', phone: '055-111-002', guardian: 'Mr. Ben Darko', gPhone: '055-222-002', addr: 'Kumasi', dob: '2013-08-20' },
          { sid: 'STU-003', name: 'Yaw Asante', cls: 'Form 2B', age: 15, gender: 'Male', phone: '055-111-003', guardian: 'Mrs. Grace Asante', gPhone: '055-222-003', addr: 'Takoradi', dob: '2011-03-10' },
          { sid: 'STU-004', name: 'Abena Osei', cls: 'Form 2B', age: 14, gender: 'Female', phone: '055-111-004', guardian: 'Mr. Paul Osei', gPhone: '055-222-004', addr: 'Cape Coast', dob: '2012-11-05' },
          { sid: 'STU-005', name: 'Kojo Antwi', cls: 'Form 3A', age: 16, gender: 'Male', phone: '055-111-005', guardian: 'Mrs. Rita Antwi', gPhone: '055-222-005', addr: 'Tamale', dob: '2010-01-25' },
        ];
        for (const s of STUDENTS) {
          await query(
            `INSERT INTO students (student_id,name,class_id,age,gender,phone,guardian,guardian_phone,address,date_of_birth)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (student_id) DO NOTHING`,
            [s.sid, s.name, clsMap[s.cls], s.age, s.gender, s.phone, s.guardian, s.gPhone, s.addr, s.dob]
          );
        }

        // Link seeded teachers and students to their user IDs
        await query(`
          UPDATE teachers t
          SET user_id = u.id
          FROM users u
          WHERE t.email = u.email AND u.role = 'Teacher'
        `);
        await query(`
          UPDATE students s
          SET user_id = u.id
          FROM users u
          WHERE s.name = u.name AND u.role = 'Student'
        `);

        // Link demo teacher (Mrs. Efua Mensah) to subjects and classes
        const { rows: tRows } = await query("SELECT id FROM teachers WHERE email = 'teacher@educore.edu'");
        if (tRows.length) {
          const efuaId = tRows[0].id;
          const { rows: sRows } = await query("SELECT id FROM subjects WHERE code IN ('MATH', 'ENG')");
          for (const s of sRows) {
            await query("INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [efuaId, s.id]);
          }
          const { rows: cRows } = await query("SELECT id FROM classes WHERE name IN ('Form 1A', 'Form 2B')");
          for (const c of cRows) {
            await query("INSERT INTO teacher_classes (teacher_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [efuaId, c.id]);
          }
        }
      }
    });
  }

  try {
    // Run seed on both live and demo databases
    await seedDatabase('live');
    await seedDatabase('demo');

    return res.json({
      success: true,
      message: '✅ Production and Demo databases seeded successfully! Live admin + demo accounts ready.',
      admin: 'teiezekiel131@gmail.com',
    });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ error: 'Seeding failed: ' + err.message });
  }
});

module.exports = router;
