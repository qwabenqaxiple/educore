// routes/subjects.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  const { rows } = await query(
    `SELECT s.*,
       COALESCE(json_agg(sc.class_id) FILTER (WHERE sc.class_id IS NOT NULL), '[]') AS class_ids
     FROM subjects s
     LEFT JOIN subject_classes sc ON sc.subject_id = s.id
     GROUP BY s.id ORDER BY s.name`
  );
  res.json(rows);
});

router.post('/', authenticate, authorize('Admin'), async (req, res) => {
  const { name, code, classIds=[] } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  try {
    const { rows } = await query(
      `INSERT INTO subjects (name,code) VALUES ($1,$2) RETURNING *`, [name, code]
    );
    const sid = rows[0].id;
    for (const cid of classIds) {
      await query('INSERT INTO subject_classes VALUES ($1,$2) ON CONFLICT DO NOTHING', [sid,cid]);
    }
    res.status(201).json({ ...rows[0], class_ids: classIds });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Subject code already exists' });
    throw err;
  }
});

router.put('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const { name, code, classIds=[] } = req.body;
  const { rows } = await query(
    `UPDATE subjects SET name=$1,code=$2 WHERE id=$3 RETURNING *`, [name, code, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  await query('DELETE FROM subject_classes WHERE subject_id=$1', [req.params.id]);
  for (const cid of classIds) {
    await query('INSERT INTO subject_classes VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id,cid]);
  }
  res.json({ ...rows[0], class_ids: classIds });
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  await query('DELETE FROM subjects WHERE id=$1', [req.params.id]);
  res.json({ message: 'Subject deleted' });
});

module.exports = router;
