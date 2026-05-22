// routes/notifications.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const { rows } = await query(
    `SELECT n.*, u.name AS sender_name, u.role AS sender_role 
     FROM notifications n
     LEFT JOIN users u ON n.sender_id = u.id
     WHERE n.user_id=$1 
     ORDER BY n.created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(rows);
});

// ─── GET /api/notifications/sent ──────────────────────────────────────────────
router.get('/sent', authenticate, authorize('Admin', 'Teacher'), async (req, res) => {
  const { rows } = await query(
    `SELECT n.*, u.name AS recipient_name, u.role AS recipient_role
     FROM notifications n
     LEFT JOIN users u ON n.user_id = u.id
     WHERE n.sender_id = $1
     ORDER BY n.created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json(rows);
});

// ─── POST /api/notifications ──────────────────────────────────────────────────
router.post('/', authenticate, authorize('Admin', 'Teacher'), async (req, res) => {
  const { title, message, type, target } = req.body;
  
  if (!title || !message || !target) {
    return res.status(400).json({ error: 'Title, message, and target are required' });
  }

  try {
    let userIds = [];

    // Resolve target to user IDs
    if (target === 'all') {
      const { rows } = await query('SELECT id FROM users');
      userIds = rows.map(r => r.id);
    } else if (target === 'teachers') {
      const { rows } = await query("SELECT id FROM users WHERE role = 'Teacher'");
      userIds = rows.map(r => r.id);
    } else if (target === 'students') {
      const { rows } = await query("SELECT id FROM users WHERE role = 'Student'");
      userIds = rows.map(r => r.id);
    } else if (target === 'parents') {
      const { rows } = await query("SELECT id FROM users WHERE role = 'Parent'");
      userIds = rows.map(r => r.id);
    } else {
      // Direct recipient ID
      const { rows } = await query('SELECT id FROM users WHERE id = $1', [parseInt(target)]);
      if (rows.length) userIds = [rows[0].id];
    }

    if (!userIds.length) {
      return res.status(400).json({ error: 'No matching recipient users found' });
    }

    // Dynamic bulk insert
    const values = [];
    const placeholders = [];
    userIds.forEach((uid, idx) => {
      const startParam = idx * 6;
      placeholders.push(`($${startParam + 1}, $${startParam + 2}, $${startParam + 3}, $${startParam + 4}, $${startParam + 5}, $${startParam + 6})`);
      values.push(uid, title, message, type || 'info', false, req.user.id);
    });

    const queryStr = `
      INSERT INTO notifications (user_id, title, message, type, read, sender_id)
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const { rows } = await query(queryStr, values);
    res.status(201).json({ message: `Successfully sent to ${userIds.length} users`, count: userIds.length, notifications: rows });
  } catch (err) {
    console.error('Error sending notification:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ─── PUT /api/notifications/:id/read ──────────────────────────────────────────
router.put('/:id/read', authenticate, async (req, res) => {
  await query('UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2',
    [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read' });
});

// ─── PUT /api/notifications/read-all ─────────────────────────────────────────
router.put('/read-all', authenticate, async (req, res) => {
  await query('UPDATE notifications SET read=true WHERE user_id=$1', [req.user.id]);
  res.json({ message: 'All marked as read' });
});

// ─── DELETE /api/notifications/:id ────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  await query('DELETE FROM notifications WHERE id=$1 AND user_id=$2',
    [req.params.id, req.user.id]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
