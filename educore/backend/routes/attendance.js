// routes/attendance.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { sendAttendanceAlert, createNotification } = require('../middleware/notify');

// GET /api/attendance?classId=&date=&studentId=
router.get('/', authenticate, async (req, res) => {
  const { classId, date, studentId } = req.query;
  const { role, assignedClassIds, studentId: currentStudentId, childStudentIds } = req.userContext;

  let sql = `
    SELECT a.*, s.name AS student_name, s.student_id AS student_code
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE 1=1`;
  const params = [];

  if (role === 'Teacher') {
    if (!assignedClassIds || !assignedClassIds.length) {
      return res.json([]);
    }
    sql += ` AND a.class_id = ANY($${params.length + 1})`;
    params.push(assignedClassIds);

    if (classId && !assignedClassIds.includes(parseInt(classId))) {
      return res.status(403).json({ error: 'Access denied. You are not assigned to this class.' });
    }
  } else if (role === 'Student') {
    if (!currentStudentId) {
      return res.json([]);
    }
    sql += ` AND a.student_id = $${params.length + 1}`;
    params.push(currentStudentId);
  } else if (role === 'Parent') {
    if (!childStudentIds || !childStudentIds.length) {
      return res.json([]);
    }
    sql += ` AND a.student_id = ANY($${params.length + 1})`;
    params.push(childStudentIds);
  }

  if (classId)   { params.push(classId);   sql += ` AND a.class_id=$${params.length}`; }
  if (date)      { params.push(date);       sql += ` AND a.date=$${params.length}`; }
  if (studentId) { params.push(studentId);  sql += ` AND a.student_id=$${params.length}`; }
  sql += ' ORDER BY a.date DESC, s.name';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// POST /api/attendance/bulk — mark multiple students at once
router.post('/bulk', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { classId, date, records } = req.body;
  // records: [{studentId, status}]
  if (!classId || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'classId, date, and records[] required' });
  }

  const { role, assignedClassIds } = req.userContext;
  if (role === 'Teacher' && !assignedClassIds.includes(parseInt(classId))) {
    return res.status(403).json({ error: 'Access denied. You can only mark attendance for your assigned classes.' });
  }

  const saved = [];
  for (const r of records) {
    const { rows } = await query(
      `INSERT INTO attendance (student_id, class_id, date, status)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (student_id, class_id, date) DO UPDATE SET status=EXCLUDED.status
       RETURNING *`,
      [r.studentId, classId, date, r.status]
    );
    saved.push(rows[0]);

    // Send email alert for absent/late students
    if (r.status !== 'Present') {
      const { rows: studs } = await query(
        'SELECT * FROM students WHERE id=$1', [r.studentId]
      );
      if (studs.length) {
        sendAttendanceAlert(studs[0], r.status, date).catch(console.error);
      }
    }
  }

  res.json({ saved, count: saved.length });
});

// PUT /api/attendance/:id
router.put('/:id', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { status } = req.body;

  const { rows: record } = await query('SELECT class_id FROM attendance WHERE id=$1', [req.params.id]);
  if (!record.length) return res.status(404).json({ error: 'Record not found' });

  const { role, assignedClassIds } = req.userContext;
  if (role === 'Teacher' && !assignedClassIds.includes(record[0].class_id)) {
    return res.status(403).json({ error: 'Access denied. You are not assigned to this class.' });
  }

  const { rows } = await query(
    `UPDATE attendance SET status=$1 WHERE id=$2 RETURNING *`, [status, req.params.id]
  );
  res.json(rows[0]);
});

// DELETE /api/attendance/:id
router.delete('/:id', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { rows: record } = await query('SELECT class_id FROM attendance WHERE id=$1', [req.params.id]);
  if (!record.length) return res.status(404).json({ error: 'Record not found' });

  const { role, assignedClassIds } = req.userContext;
  if (role === 'Teacher' && !assignedClassIds.includes(record[0].class_id)) {
    return res.status(403).json({ error: 'Access denied. You are not assigned to this class.' });
  }

  await query('DELETE FROM attendance WHERE id=$1', [req.params.id]);
  res.json({ message: 'Attendance record deleted' });
});

// GET /api/attendance/report?classId=&startDate=&endDate=
router.get('/report', authenticate, async (req, res) => {
  const { classId, startDate, endDate } = req.query;
  const { role, assignedClassIds, studentId, childStudentIds } = req.userContext;

  if (role === 'Teacher') {
    if (!classId || !assignedClassIds.includes(parseInt(classId))) {
      return res.status(403).json({ error: 'Access denied. You are not assigned to this class.' });
    }
  } else if (role === 'Student') {
    if (!studentId) return res.json([]);
    const { rows } = await query(`
      SELECT s.id, s.name, s.student_id AS student_code,
        COUNT(*) FILTER (WHERE a.status='Present') AS present,
        COUNT(*) FILTER (WHERE a.status='Absent')  AS absent,
        COUNT(*) FILTER (WHERE a.status='Late')    AS late,
        COUNT(*)::int AS total
      FROM students s
      LEFT JOIN attendance a ON a.student_id=s.id
        ${startDate ? `AND a.date >= '${startDate}'` : ''}
        ${endDate   ? `AND a.date <= '${endDate}'`   : ''}
      WHERE s.id=$1
      GROUP BY s.id, s.name, s.student_id`,
      [studentId]
    );
    return res.json(rows);
  } else if (role === 'Parent') {
    if (!childStudentIds || !childStudentIds.length) return res.json([]);
    const { rows } = await query(`
      SELECT s.id, s.name, s.student_id AS student_code,
        COUNT(*) FILTER (WHERE a.status='Present') AS present,
        COUNT(*) FILTER (WHERE a.status='Absent')  AS absent,
        COUNT(*) FILTER (WHERE a.status='Late')    AS late,
        COUNT(*)::int AS total
      FROM students s
      LEFT JOIN attendance a ON a.student_id=s.id
        ${startDate ? `AND a.date >= '${startDate}'` : ''}
        ${endDate   ? `AND a.date <= '${endDate}'`   : ''}
      WHERE s.id = ANY($1)
      GROUP BY s.id, s.name, s.student_id`,
      [childStudentIds]
    );
    return res.json(rows);
  }

  const { rows } = await query(`
    SELECT s.id, s.name, s.student_id AS student_code,
      COUNT(*) FILTER (WHERE a.status='Present') AS present,
      COUNT(*) FILTER (WHERE a.status='Absent')  AS absent,
      COUNT(*) FILTER (WHERE a.status='Late')    AS late,
      COUNT(*)::int AS total
    FROM students s
    LEFT JOIN attendance a ON a.student_id=s.id AND a.class_id=$1
      ${startDate ? `AND a.date >= '${startDate}'` : ''}
      ${endDate   ? `AND a.date <= '${endDate}'`   : ''}
    WHERE s.class_id=$1
    GROUP BY s.id, s.name, s.student_id
    ORDER BY s.name`,
    [classId]
  );
  res.json(rows);
});

module.exports = router;
