// routes/teachers.js
const router = require('express').Router();
const { query, getClient } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/teachers
router.get('/', authenticate, async (req, res) => {
  const { rows: teachers } = await query(
    `SELECT t.*, 
       COALESCE(json_agg(DISTINCT ts.subject_id) FILTER (WHERE ts.subject_id IS NOT NULL), '[]') AS subjects,
       COALESCE(json_agg(DISTINCT tc.class_id)   FILTER (WHERE tc.class_id   IS NOT NULL), '[]') AS classes
     FROM teachers t
     LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
     LEFT JOIN teacher_classes  tc ON tc.teacher_id = t.id
     GROUP BY t.id ORDER BY t.created_at`
  );
  res.json(teachers);
});

router.get('/:id', authenticate, async (req, res) => {
  const { rows } = await query(`
    SELECT t.*,
      COALESCE(json_agg(DISTINCT ts.subject_id) FILTER (WHERE ts.subject_id IS NOT NULL), '[]') AS subjects,
      COALESCE(json_agg(DISTINCT tc.class_id)   FILTER (WHERE tc.class_id   IS NOT NULL), '[]') AS classes
    FROM teachers t
    LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
    LEFT JOIN teacher_classes  tc ON tc.teacher_id = t.id
    WHERE t.id=$1 GROUP BY t.id`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Teacher not found' });
  res.json(rows[0]);
});

router.post('/', authenticate, authorize('Admin'), async (req, res) => {
  const { staffId, name, email, phone, gender, qualification, subjects=[], classes=[] } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO teachers (staff_id,name,email,phone,gender,qualification)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [staffId, name, email, phone||null, gender||null, qualification||null]
    );
    const tid = rows[0].id;
    for (const sid of subjects) await client.query('INSERT INTO teacher_subjects VALUES ($1,$2) ON CONFLICT DO NOTHING', [tid,sid]);
    for (const cid of classes)  await client.query('INSERT INTO teacher_classes  VALUES ($1,$2) ON CONFLICT DO NOTHING', [tid,cid]);
    await client.query('COMMIT');
    res.status(201).json({ ...rows[0], subjects, classes });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email or Staff ID already exists' });
    throw err;
  } finally { client.release(); }
});

router.put('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const { name, email, phone, gender, qualification, subjects=[], classes=[] } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE teachers SET name=$1,email=$2,phone=$3,gender=$4,qualification=$5 WHERE id=$6 RETURNING *`,
      [name, email, phone||null, gender||null, qualification||null, req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('DELETE FROM teacher_subjects WHERE teacher_id=$1', [req.params.id]);
    await client.query('DELETE FROM teacher_classes  WHERE teacher_id=$1', [req.params.id]);
    for (const sid of subjects) await client.query('INSERT INTO teacher_subjects VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id,sid]);
    for (const cid of classes)  await client.query('INSERT INTO teacher_classes  VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id,cid]);
    await client.query('COMMIT');
    res.json({ ...rows[0], subjects, classes });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const { rows } = await query('DELETE FROM teachers WHERE id=$1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Teacher deleted' });
});

module.exports = router;
