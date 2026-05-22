// routes/fees.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { sendFeeReminder } = require('../middleware/notify');

const BASE = `
  SELECT f.*, s.name AS student_name, s.student_id AS student_code,
    (f.amount - f.paid) AS balance
  FROM fees f
  JOIN students s ON s.id=f.student_id`;

router.get('/', authenticate, async (req, res) => {
  const { studentId, term, year, status } = req.query;
  const { role, studentId: currentStudentId, childStudentIds } = req.userContext;

  if (role === 'Teacher') {
    return res.status(403).json({ error: 'Access denied. Teachers do not have access to fee records.' });
  }

  let sql = BASE + ' WHERE 1=1';
  const params = [];

  if (role === 'Student') {
    if (!currentStudentId) {
      return res.json([]);
    }
    sql += ` AND f.student_id = $${params.length + 1}`;
    params.push(currentStudentId);
  } else if (role === 'Parent') {
    if (!childStudentIds || !childStudentIds.length) {
      return res.json([]);
    }
    sql += ` AND f.student_id = ANY($${params.length + 1})`;
    params.push(childStudentIds);
  }

  if (studentId) { params.push(studentId); sql += ` AND f.student_id=$${params.length}`; }
  if (term)      { params.push(term);      sql += ` AND f.term=$${params.length}`; }
  if (year)      { params.push(year);      sql += ` AND f.year=$${params.length}`; }
  if (status === 'paid')        sql += ' AND f.paid >= f.amount';
  if (status === 'outstanding') sql += ' AND f.paid < f.amount';
  sql += ' ORDER BY f.created_at DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.post('/', authenticate, authorize('Admin'), async (req, res) => {
  const { studentId, amount, paid=0, term, year, date, method } = req.body;
  if (!studentId || !amount) return res.status(400).json({ error: 'studentId and amount required' });

  const { rows: [count] } = await query('SELECT COUNT(*)+1 AS n FROM fees');
  const receiptNo = `RCP-${String(count.n).padStart(4,'0')}`;

  const { rows } = await query(
    `INSERT INTO fees (student_id,amount,paid,term,year,date,method,receipt_no)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [studentId, amount, paid, term, year, date||null, method||null, receiptNo]
  );
  res.status(201).json({ ...rows[0], balance: amount - paid });
});

router.put('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const { amount, paid, term, year, date, method } = req.body;
  const { rows } = await query(
    `UPDATE fees SET amount=COALESCE($1,amount),paid=$2,term=COALESCE($3,term),year=COALESCE($4,year),date=$5,method=$6 WHERE id=$7 RETURNING *`,
    [amount||null, paid, term||null, year||null, date||null, method||null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ ...rows[0], balance: rows[0].amount - rows[0].paid });
});

// DELETE /api/fees/:id
router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  await query('DELETE FROM fees WHERE id=$1', [req.params.id]);
  res.json({ message: 'Fee record deleted' });
});

// POST /api/fees/:id/remind — send fee reminder email
router.post('/:id/remind', authenticate, authorize('Admin'), async (req, res) => {
  const { rows: fees } = await query(BASE + ' WHERE f.id=$1', [req.params.id]);
  if (!fees.length) return res.status(404).json({ error: 'Fee record not found' });
  const fee = fees[0];
  if (fee.balance <= 0) return res.status(400).json({ error: 'No outstanding balance' });

  const { rows: studs } = await query('SELECT * FROM students WHERE id=$1',[fee.student_id]);
  await sendFeeReminder(studs[0], fee);
  res.json({ message: 'Reminder sent' });
});

// GET /api/fees/summary
router.get('/summary', authenticate, authorize('Admin'), async (req, res) => {
  const { rows } = await query(`
    SELECT
      SUM(amount)::numeric AS total_billed,
      SUM(paid)::numeric   AS total_collected,
      SUM(amount-paid)::numeric AS total_outstanding,
      COUNT(*) FILTER (WHERE paid >= amount) AS paid_count,
      COUNT(*) FILTER (WHERE paid < amount)  AS outstanding_count
    FROM fees`
  );
  res.json(rows[0]);
});

module.exports = router;
