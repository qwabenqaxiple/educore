// routes/reports.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/reports/dashboard — stats for admin dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  const { role, assignedClassIds, studentId, classId: studentClassId, childStudentIds, childClassIds } = req.userContext;

  try {
    if (role === 'Admin') {
      const [students, teachers, classes, subjects, exams, fees, attendance] = await Promise.all([
        query('SELECT COUNT(*)::int AS count FROM students'),
        query('SELECT COUNT(*)::int AS count FROM teachers'),
        query('SELECT COUNT(*)::int AS count FROM classes'),
        query('SELECT COUNT(*)::int AS count FROM subjects'),
        query('SELECT COUNT(*)::int AS count FROM exams'),
        query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total_billed, COALESCE(SUM(paid), 0)::numeric AS total_collected,
                COALESCE(SUM(amount-paid), 0)::numeric AS total_outstanding FROM fees`),
        query(`SELECT
          COUNT(*) FILTER (WHERE status='Present')::int AS present,
          COUNT(*) FILTER (WHERE status='Absent')::int  AS absent,
          COUNT(*) FILTER (WHERE status='Late')::int    AS late,
          COUNT(*)::int                                  AS total
          FROM attendance`),
      ]);

      return res.json({
        students:   students.rows[0].count,
        teachers:   teachers.rows[0].count,
        classes:    classes.rows[0].count,
        subjects:   subjects.rows[0].count,
        exams:      exams.rows[0].count,
        fees:       fees.rows[0],
        attendance: attendance.rows[0],
      });
    }

    if (role === 'Teacher') {
      if (!assignedClassIds || assignedClassIds.length === 0) {
        return res.json({
          students: 0,
          teachers: 1,
          classes: 0,
          subjects: 0,
          exams: 0,
          fees: { total_billed: 0, total_collected: 0, total_outstanding: 0 },
          attendance: { present: 0, absent: 0, late: 0, total: 0 }
        });
      }

      const [students, teachers, classes, subjects, exams, attendance] = await Promise.all([
        query('SELECT COUNT(*)::int AS count FROM students WHERE class_id = ANY($1::int[])', [assignedClassIds]),
        query('SELECT COUNT(*)::int AS count FROM teachers'),
        query('SELECT COUNT(*)::int AS count FROM classes WHERE id = ANY($1::int[])', [assignedClassIds]),
        query('SELECT COUNT(DISTINCT subject_id)::int AS count FROM timetable WHERE class_id = ANY($1::int[])', [assignedClassIds]),
        query('SELECT COUNT(*)::int AS count FROM exams WHERE class_id = ANY($1::int[])', [assignedClassIds]),
        query(`SELECT
          COUNT(*) FILTER (WHERE status='Present')::int AS present,
          COUNT(*) FILTER (WHERE status='Absent')::int  AS absent,
          COUNT(*) FILTER (WHERE status='Late')::int    AS late,
          COUNT(*)::int                                  AS total
          FROM attendance a
          JOIN students s ON s.id = a.student_id
          WHERE s.class_id = ANY($1::int[])`, [assignedClassIds]),
      ]);

      return res.json({
        students:   students.rows[0].count,
        teachers:   teachers.rows[0].count,
        classes:    classes.rows[0].count,
        subjects:   subjects.rows[0].count,
        exams:      exams.rows[0].count,
        fees:       { total_billed: 0, total_collected: 0, total_outstanding: 0 },
        attendance: attendance.rows[0],
      });
    }

    if (role === 'Student') {
      if (!studentClassId || !studentId) {
        return res.json({
          students: 1,
          teachers: 0,
          classes: 1,
          subjects: 0,
          exams: 0,
          fees: { total_billed: 0, total_collected: 0, total_outstanding: 0 },
          attendance: { present: 0, absent: 0, late: 0, total: 0 }
        });
      }

      const [teachers, subjects, exams, fees, attendance] = await Promise.all([
        query('SELECT COUNT(DISTINCT teacher_id)::int AS count FROM timetable WHERE class_id = $1', [studentClassId]),
        query('SELECT COUNT(DISTINCT subject_id)::int AS count FROM timetable WHERE class_id = $1', [studentClassId]),
        query('SELECT COUNT(*)::int AS count FROM exams WHERE class_id = $1', [studentClassId]),
        query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total_billed, COALESCE(SUM(paid), 0)::numeric AS total_collected,
                COALESCE(SUM(amount-paid), 0)::numeric AS total_outstanding FROM fees WHERE student_id = $1`, [studentId]),
        query(`SELECT
          COUNT(*) FILTER (WHERE status='Present')::int AS present,
          COUNT(*) FILTER (WHERE status='Absent')::int  AS absent,
          COUNT(*) FILTER (WHERE status='Late')::int    AS late,
          COUNT(*)::int                                  AS total
          FROM attendance WHERE student_id = $1`, [studentId]),
      ]);

      return res.json({
        students:   1,
        teachers:   teachers.rows[0].count,
        classes:    1,
        subjects:   subjects.rows[0].count,
        exams:      exams.rows[0].count,
        fees:       fees.rows[0],
        attendance: attendance.rows[0],
      });
    }

    if (role === 'Parent') {
      if (!childStudentIds || childStudentIds.length === 0) {
        return res.json({
          students: 0,
          teachers: 0,
          classes: 0,
          subjects: 0,
          exams: 0,
          fees: { total_billed: 0, total_collected: 0, total_outstanding: 0 },
          attendance: { present: 0, absent: 0, late: 0, total: 0 }
        });
      }

      const activeChildClassIds = childClassIds && childClassIds.length ? childClassIds : [0];

      const [teachers, subjects, exams, fees, attendance] = await Promise.all([
        query('SELECT COUNT(DISTINCT teacher_id)::int AS count FROM timetable WHERE class_id = ANY($1::int[])', [activeChildClassIds]),
        query('SELECT COUNT(DISTINCT subject_id)::int AS count FROM timetable WHERE class_id = ANY($1::int[])', [activeChildClassIds]),
        query('SELECT COUNT(*)::int AS count FROM exams WHERE class_id = ANY($1::int[])', [activeChildClassIds]),
        query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total_billed, COALESCE(SUM(paid), 0)::numeric AS total_collected,
                COALESCE(SUM(amount-paid), 0)::numeric AS total_outstanding FROM fees WHERE student_id = ANY($1::int[])`, [childStudentIds]),
        query(`SELECT
          COUNT(*) FILTER (WHERE status='Present')::int AS present,
          COUNT(*) FILTER (WHERE status='Absent')::int  AS absent,
          COUNT(*) FILTER (WHERE status='Late')::int    AS late,
          COUNT(*)::int                                  AS total
          FROM attendance WHERE student_id = ANY($1::int[])`, [childStudentIds]),
      ]);

      return res.json({
        students:   childStudentIds.length,
        teachers:   teachers.rows[0].count,
        classes:    activeChildClassIds.filter(id => id !== 0).length,
        subjects:   subjects.rows[0].count,
        exams:      exams.rows[0].count,
        fees:       fees.rows[0],
        attendance: attendance.rows[0],
      });
    }

    res.status(403).json({ error: 'Role not supported for dashboard' });
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
    res.status(500).json({ error: 'Server error loading dashboard' });
  }
});

// GET /api/reports/attendance — full attendance summary per student
router.get('/attendance', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { classId, startDate, endDate } = req.query;
  const { role, assignedClassIds } = req.userContext;

  let sql = `
    SELECT s.id, s.name, s.student_id AS student_code, c.name AS class_name,
      COUNT(*) FILTER (WHERE a.status='Present')::int AS present,
      COUNT(*) FILTER (WHERE a.status='Absent')::int  AS absent,
      COUNT(*) FILTER (WHERE a.status='Late')::int    AS late,
      COUNT(*)::int AS total
    FROM students s
    LEFT JOIN classes c ON c.id=s.class_id
    LEFT JOIN attendance a ON a.student_id=s.id
      ${startDate ? `AND a.date >= '${startDate}'` : ''}
      ${endDate   ? `AND a.date <= '${endDate}'`   : ''}
    WHERE 1=1`;
  const params = [];

  if (role === 'Teacher') {
    if (classId) {
      const cId = parseInt(classId, 10);
      if (!assignedClassIds.includes(cId)) {
        return res.status(403).json({ error: 'Access denied. You are not assigned to this class.' });
      }
      params.push(cId);
      sql += ` AND s.class_id=$${params.length}`;
    } else {
      if (!assignedClassIds || assignedClassIds.length === 0) {
        return res.json([]);
      }
      const placeholders = assignedClassIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      assignedClassIds.forEach(id => params.push(id));
      sql += ` AND s.class_id IN (${placeholders})`;
    }
  } else {
    if (classId) {
      params.push(classId);
      sql += ` AND s.class_id=$${params.length}`;
    }
  }

  sql += ' GROUP BY s.id, s.name, s.student_id, c.name ORDER BY s.name';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// GET /api/reports/fees
router.get('/fees', authenticate, authorize('Admin'), async (req, res) => {
  const { term, year } = req.query;
  let sql = `
    SELECT f.*, s.name AS student_name, s.student_id AS student_code,
      (f.amount-f.paid) AS balance
    FROM fees f JOIN students s ON s.id=f.student_id
    WHERE 1=1`;
  const params = [];
  if (term) { params.push(term); sql += ` AND f.term=$${params.length}`; }
  if (year) { params.push(year); sql += ` AND f.year=$${params.length}`; }
  sql += ' ORDER BY s.name';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// GET /api/reports/results?classId=&examId=
router.get('/results', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { classId, examId } = req.query;
  const { role, assignedClassIds } = req.userContext;

  let sql = `
    SELECT r.score, s.name AS student_name, s.student_id AS student_code,
      e.name AS exam_name, e.total_marks, e.term, e.year, sub.name AS subject_name
    FROM results r
    JOIN students s ON s.id=r.student_id
    JOIN exams    e ON e.id=r.exam_id
    LEFT JOIN subjects sub ON sub.id=e.subject_id
    WHERE 1=1`;
  const params = [];

  if (role === 'Teacher') {
    if (classId) {
      const cId = parseInt(classId, 10);
      if (!assignedClassIds.includes(cId)) {
        return res.status(403).json({ error: 'Access denied. You are not assigned to this class.' });
      }
      params.push(cId);
      sql += ` AND s.class_id=$${params.length}`;
    } else {
      if (!assignedClassIds || assignedClassIds.length === 0) {
        return res.json([]);
      }
      const placeholders = assignedClassIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      assignedClassIds.forEach(id => params.push(id));
      sql += ` AND s.class_id IN (${placeholders})`;
    }
  } else {
    if (classId) {
      params.push(classId);
      sql += ` AND s.class_id=$${params.length}`;
    }
  }

  if (examId)  { params.push(examId);  sql += ` AND r.exam_id=$${params.length}`; }
  sql += ' ORDER BY s.name, e.date DESC NULLS LAST';
  const { rows } = await query(sql, params);
  res.json(rows);
});

module.exports = router;
