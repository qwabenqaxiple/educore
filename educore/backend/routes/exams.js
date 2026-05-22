// routes/exams.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { sendResultsNotification } = require('../middleware/notify');

// GET /api/exams
router.get('/', authenticate, async (req, res) => {
  const { classId, term } = req.query;
  const { role, assignedClassIds, classId: studentClassId, childClassIds } = req.userContext;

  let sql = `
    SELECT e.*, c.name AS class_name, s.name AS subject_name,
      COUNT(DISTINCT r.student_id)::int AS scored_count
    FROM exams e
    LEFT JOIN classes  c ON c.id=e.class_id
    LEFT JOIN subjects s ON s.id=e.subject_id
    LEFT JOIN results  r ON r.exam_id=e.id
    WHERE 1=1`;
  const params = [];

  if (role === 'Teacher') {
    if (!assignedClassIds || !assignedClassIds.length) {
      return res.json([]);
    }
    sql += ` AND e.class_id = ANY($${params.length + 1})`;
    params.push(assignedClassIds);
  } else if (role === 'Student') {
    if (!studentClassId) {
      return res.json([]);
    }
    sql += ` AND e.class_id = $${params.length + 1}`;
    params.push(studentClassId);
  } else if (role === 'Parent') {
    if (!childClassIds || !childClassIds.length) {
      return res.json([]);
    }
    sql += ` AND e.class_id = ANY($${params.length + 1})`;
    params.push(childClassIds);
  }

  if (classId) { params.push(classId); sql += ` AND e.class_id=$${params.length}`; }
  if (term)    { params.push(term);    sql += ` AND e.term=$${params.length}`; }
  sql += ' GROUP BY e.id,c.name,s.name ORDER BY e.date DESC NULLS LAST';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// POST /api/exams
router.post('/', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { name, term, year, classId, subjectId, date, totalMarks=100 } = req.body;
  if (!name || !classId) return res.status(400).json({ error: 'Name and class required' });

  const { role, assignedClassIds } = req.userContext;
  if (role === 'Teacher' && !assignedClassIds.includes(parseInt(classId))) {
    return res.status(403).json({ error: 'Access denied. You can only create exams for your assigned classes.' });
  }

  const { rows } = await query(
    `INSERT INTO exams (name,term,year,class_id,subject_id,date,total_marks)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, term, year, classId, subjectId||null, date||null, totalMarks]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { name, term, year, classId, subjectId, date, totalMarks } = req.body;

  const { rows: exam } = await query('SELECT class_id FROM exams WHERE id=$1', [req.params.id]);
  if (!exam.length) return res.status(404).json({ error: 'Exam not found' });

  const { role, assignedClassIds } = req.userContext;
  if (role === 'Teacher') {
    if (!assignedClassIds.includes(exam[0].class_id)) {
      return res.status(403).json({ error: 'Access denied. You are not assigned to this class.' });
    }
    if (classId && !assignedClassIds.includes(parseInt(classId))) {
      return res.status(403).json({ error: 'Access denied. You can only assign exams to your own classes.' });
    }
  }

  const { rows } = await query(
    `UPDATE exams SET name=$1,term=$2,year=$3,class_id=$4,subject_id=$5,date=$6,total_marks=$7
     WHERE id=$8 RETURNING *`,
    [name, term, year, classId, subjectId||null, date||null, totalMarks, req.params.id]
  );
  res.json(rows[0]);
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  await query('DELETE FROM exams WHERE id=$1', [req.params.id]);
  res.json({ message: 'Exam deleted' });
});

// ─── Results ──────────────────────────────────────────────────────────────────

// GET /api/exams/results?examId=&studentId=
router.get('/results', authenticate, async (req, res) => {
  const { examId, studentId } = req.query;
  const { role, assignedClassIds, studentId: currentStudentId, childStudentIds } = req.userContext;

  let sql = `
    SELECT r.*, s.name AS student_name, s.student_id AS student_code,
      e.name AS exam_name, e.total_marks, e.term, e.year,
      sub.name AS subject_name
    FROM results r
    JOIN students s ON s.id=r.student_id
    JOIN exams    e ON e.id=r.exam_id
    LEFT JOIN subjects sub ON sub.id=e.subject_id
    WHERE 1=1`;
  const params = [];

  if (role === 'Teacher') {
    if (!assignedClassIds || !assignedClassIds.length) {
      return res.json([]);
    }
    sql += ` AND s.class_id = ANY($${params.length + 1})`;
    params.push(assignedClassIds);
  } else if (role === 'Student') {
    if (!currentStudentId) {
      return res.json([]);
    }
    sql += ` AND r.student_id = $${params.length + 1}`;
    params.push(currentStudentId);
  } else if (role === 'Parent') {
    if (!childStudentIds || !childStudentIds.length) {
      return res.json([]);
    }
    sql += ` AND r.student_id = ANY($${params.length + 1})`;
    params.push(childStudentIds);
  }

  if (examId)    { params.push(examId);    sql += ` AND r.exam_id=$${params.length}`; }
  if (studentId) { params.push(studentId); sql += ` AND r.student_id=$${params.length}`; }
  sql += ' ORDER BY e.date DESC NULLS LAST';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// POST /api/exams/results/bulk — save scores for an entire exam
router.post('/results/bulk', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { examId, scores } = req.body; // scores: [{studentId, score}]
  if (!examId || !Array.isArray(scores)) {
    return res.status(400).json({ error: 'examId and scores[] required' });
  }

  const { rows: exam } = await query('SELECT class_id FROM exams WHERE id=$1', [examId]);
  if (!exam.length) return res.status(404).json({ error: 'Exam not found' });

  const { role, assignedClassIds } = req.userContext;
  if (role === 'Teacher' && !assignedClassIds.includes(exam[0].class_id)) {
    return res.status(403).json({ error: 'Access denied. You can only enter scores for exams of your assigned classes.' });
  }

  const saved = [];
  for (const s of scores) {
    if (s.score === '' || s.score === null || s.score === undefined) continue;
    const { rows } = await query(
      `INSERT INTO results (exam_id, student_id, score)
       VALUES ($1,$2,$3)
       ON CONFLICT (exam_id, student_id) DO UPDATE SET score=EXCLUDED.score
       RETURNING *`,
      [examId, s.studentId, s.score]
    );
    saved.push(rows[0]);

    // Notify parents/students
    try {
      const { rows: studs } = await query('SELECT * FROM students WHERE id=$1',[s.studentId]);
      const { rows: exams } = await query('SELECT e.*,sub.name AS sub_name FROM exams e LEFT JOIN subjects sub ON sub.id=e.subject_id WHERE e.id=$1',[examId]);
      if (studs.length && exams.length) {
        const grade = scoreToGrade(s.score);
        sendResultsNotification(studs[0], `${exams[0].name} — ${exams[0].sub_name}`, `${s.score}/${exams[0].total_marks}`, grade).catch(console.error);
      }
    } catch {}
  }

  res.json({ saved, count: saved.length });
});

const scoreToGrade = (s) => {
  if (s>=90) return 'A+'; if (s>=80) return 'A';
  if (s>=70) return 'B';  if (s>=60) return 'C';
  if (s>=50) return 'D';  return 'F';
};

// GET /api/exams/report-card/:studentId
router.get('/report-card/:studentId', authenticate, async (req, res) => {
  const { role, assignedClassIds, studentId: currentStudentId, childStudentIds } = req.userContext;
  const targetStudentId = parseInt(req.params.studentId);

  const { rows: student } = await query('SELECT class_id FROM students WHERE id=$1', [targetStudentId]);
  if (!student.length) return res.status(404).json({ error: 'Student not found' });

  if (role === 'Teacher' && !assignedClassIds.includes(student[0].class_id)) {
    return res.status(403).json({ error: 'Access denied. You are not assigned to this student\'s class.' });
  } else if (role === 'Student' && targetStudentId !== currentStudentId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own report card.' });
  } else if (role === 'Parent' && !childStudentIds.includes(targetStudentId)) {
    return res.status(403).json({ error: 'Access denied. You can only view your children\'s report cards.' });
  }

  const { rows } = await query(`
    SELECT r.score, e.name AS exam_name, e.total_marks, e.term, e.year,
      sub.name AS subject_name, sub.code AS subject_code
    FROM results r
    JOIN exams    e   ON e.id=r.exam_id
    LEFT JOIN subjects sub ON sub.id=e.subject_id
    WHERE r.student_id=$1
    ORDER BY e.year DESC, e.term, sub.name`,
    [targetStudentId]
  );
  const avg = rows.length ? rows.reduce((s,r)=>s+parseFloat(r.score),0)/rows.length : 0;
  res.json({ results: rows, average: Math.round(avg) });
});

module.exports = router;
