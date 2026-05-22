// routes/users.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const SAFE = 'id,name,email,role,phone,avatar,created_at';

router.get('/', authenticate, authorize('Admin'), async (req, res) => {
  const { rows } = await query(`SELECT ${SAFE} FROM users ORDER BY created_at`);
  res.json(rows);
});

router.get('/logins', authenticate, authorize('Admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT l.id, l.email, l.role, l.ip_address, l.user_agent, l.login_time, u.name
     FROM login_logs l
     LEFT JOIN users u ON l.user_id = u.id
     ORDER BY l.login_time DESC
     LIMIT 100`
  );
  res.json(rows);
});

router.post('/', authenticate, authorize('Admin'), async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, role required' });
  }
  const hash = await bcrypt.hash(password, 10);
  const avatar = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  try {
    const { rows } = await query(
      `INSERT INTO users (name,email,password,role,phone,avatar)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${SAFE}`,
      [name, email, hash, role, phone||null, avatar]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    throw err;
  }
});

router.put('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const { name, email, role, phone } = req.body;
  const { rows } = await query(
    `UPDATE users SET name=$1,email=$2,role=$3,phone=$4 WHERE id=$5 RETURNING ${SAFE}`,
    [name, email, role, phone||null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  if (+req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  await query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ message: 'User deleted' });
});

module.exports = router;
