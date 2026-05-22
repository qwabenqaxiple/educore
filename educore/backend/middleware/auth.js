// middleware/auth.js — JWT authentication & role authorization
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

// ─── User Context Helper ──────────────────────────────────────────────────────
const getUserContext = async (userId, role, email, phone) => {
  const context = {
    role,
    teacherId: null,
    assignedClassIds: [],
    studentId: null,
    classId: null,
    childStudentIds: [],
    childClassIds: []
  };

  if (role === 'Admin') {
    return context;
  }

  try {
    if (role === 'Teacher') {
      const tRes = await query('SELECT id FROM teachers WHERE user_id = $1 OR email = $2', [userId, email]);
      if (tRes.rows.length) {
        const teacherId = tRes.rows[0].id;
        context.teacherId = teacherId;
        const cRes = await query(`
          SELECT id FROM classes WHERE teacher_id = $1
          UNION
          SELECT class_id AS id FROM teacher_classes WHERE teacher_id = $2
        `, [userId, teacherId]);
        context.assignedClassIds = cRes.rows.map(r => r.id);
      }
    } else if (role === 'Student') {
      const sRes = await query('SELECT id, class_id FROM students WHERE user_id = $1 OR phone = $2', [userId, phone]);
      if (sRes.rows.length) {
        context.studentId = sRes.rows[0].id;
        context.classId = sRes.rows[0].class_id;
      }
    } else if (role === 'Parent') {
      if (phone) {
        const sRes = await query('SELECT id, class_id FROM students WHERE guardian_phone = $1', [phone]);
        context.childStudentIds = sRes.rows.map(r => r.id);
        context.childClassIds = [...new Set(sRes.rows.map(r => r.class_id).filter(Boolean))];
      }
    }
  } catch (err) {
    console.error('Error fetching user context:', err);
  }

  return context;
};

// ─── Verify JWT ───────────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data on each request
    const { rows } = await query(
      'SELECT id, name, email, role, phone, avatar FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    req.user = rows[0];
    req.userContext = await getUserContext(req.user.id, req.user.role, req.user.email, req.user.phone);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── Role Gate ────────────────────────────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(' or ')}`
    });
  }
  next();
};

module.exports = { authenticate, authorize };
