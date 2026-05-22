// routes/classes.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  const { role, assignedClassIds, classId, childClassIds } = req.userContext;

  let sql = `
    SELECT c.*, u.name AS teacher_name,
       COUNT(DISTINCT s.id)::int AS student_count
     FROM classes c
     LEFT JOIN users u    ON u.id = c.teacher_id
     LEFT JOIN students s ON s.class_id = c.id
     WHERE 1=1`;
  const params = [];

  if (role === 'Teacher') {
    if (!assignedClassIds || !assignedClassIds.length) {
      return res.json([]);
    }
    sql += ` AND c.id = ANY($${params.length + 1})`;
    params.push(assignedClassIds);
  } else if (role === 'Student') {
    if (!classId) {
      return res.json([]);
    }
    sql += ` AND c.id = $${params.length + 1}`;
    params.push(classId);
  } else if (role === 'Parent') {
    if (!childClassIds || !childClassIds.length) {
      return res.json([]);
    }
    sql += ` AND c.id = ANY($${params.length + 1})`;
    params.push(childClassIds);
  }

  sql += ' GROUP BY c.id, u.name ORDER BY c.name';
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.post('/', authenticate, authorize('Admin'), async (req, res) => {
  const { name, level, capacity, teacherId } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const { rows } = await query(
    `INSERT INTO classes (name,level,capacity,teacher_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, level||'JHS', capacity||40, teacherId||null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const { name, level, capacity, teacherId } = req.body;
  const { rows } = await query(
    `UPDATE classes SET name=$1,level=$2,capacity=$3,teacher_id=$4 WHERE id=$5 RETURNING *`,
    [name, level, capacity, teacherId||null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  await query('DELETE FROM classes WHERE id=$1', [req.params.id]);
  res.json({ message: 'Class deleted' });
});

module.exports = router;
