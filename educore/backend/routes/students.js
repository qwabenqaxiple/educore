// routes/students.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const BASE_QUERY = `
  SELECT s.*, c.name AS class_name
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
`;

// GET /api/students
router.get('/', authenticate, async (req, res) => {
  const { classId, search, page = 1, limit = 100 } = req.query;
  let sql = BASE_QUERY + ' WHERE 1=1';
  const params = [];

  // Enforce role-based access restrictions
  const { role, assignedClassIds, studentId, childStudentIds } = req.userContext;
  
  if (role === 'Teacher') {
    if (!assignedClassIds || !assignedClassIds.length) {
      return res.json({ students: [], total: 0 });
    }
    sql += ` AND s.class_id = ANY($${params.length + 1})`;
    params.push(assignedClassIds);
  } else if (role === 'Student') {
    if (!studentId) {
      return res.json({ students: [], total: 0 });
    }
    sql += ` AND s.id = $${params.length + 1}`;
    params.push(studentId);
  } else if (role === 'Parent') {
    if (!childStudentIds || !childStudentIds.length) {
      return res.json({ students: [], total: 0 });
    }
    sql += ` AND s.id = ANY($${params.length + 1})`;
    params.push(childStudentIds);
  }

  if (classId) { params.push(classId); sql += ` AND s.class_id = $${params.length}`; }
  if (search)  { params.push(`%${search}%`); sql += ` AND (s.name ILIKE $${params.length} OR s.student_id ILIKE $${params.length})`; }

  sql += ` ORDER BY s.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  params.push(parseInt(limit), (parseInt(page)-1)*parseInt(limit));

  const { rows } = await query(sql, params);
  
  // Count total matching records dynamically
  let countSql = 'SELECT COUNT(*)::int AS count FROM students s WHERE 1=1';
  const countParams = [];
  if (role === 'Teacher') {
    countSql += ' AND s.class_id = ANY($1)';
    countParams.push(assignedClassIds);
  } else if (role === 'Student') {
    countSql += ' AND s.id = $1';
    countParams.push(studentId);
  } else if (role === 'Parent') {
    countSql += ' AND s.id = ANY($1)';
    countParams.push(childStudentIds);
  }
  const countRes = await query(countSql, countParams);
  const totalCount = countRes.rows[0].count;

  res.json({ students: rows, total: totalCount });
});

// GET /api/students/:id
router.get('/:id', authenticate, async (req, res) => {
  const { rows } = await query(BASE_QUERY + ' WHERE s.id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Student not found' });

  const student = rows[0];
  const { role, assignedClassIds, studentId, childStudentIds } = req.userContext;

  if (role === 'Teacher' && !assignedClassIds.includes(student.class_id)) {
    return res.status(403).json({ error: 'Access denied. You are not assigned to this student\'s class.' });
  } else if (role === 'Student' && student.id !== studentId) {
    return res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
  } else if (role === 'Parent' && !childStudentIds.includes(student.id)) {
    return res.status(403).json({ error: 'Access denied. You can only view your children\'s profiles.' });
  }

  res.json(student);
});

// POST /api/students/import
router.post('/import', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Payload must contain a students array' });
  }

  const { role, assignedClassIds } = req.userContext;

  // Start Transaction
  await query('BEGIN');
  try {
    // 1. Fetch all class name to ID mapping
    const classRes = await query('SELECT id, name FROM classes');
    const classMap = {};
    for (const c of classRes.rows) {
      classMap[c.name.toLowerCase().trim()] = c.id;
    }

    // 2. Fetch the starting base sequence number for student ID auto-generation
    const lastStudent = await query(
      `SELECT student_id FROM students 
       WHERE student_id LIKE 'STU-%' 
       ORDER BY student_id DESC LIMIT 1`
    );
    let nextNum = 1;
    if (lastStudent.rows.length) {
      const match = lastStudent.rows[0].student_id.match(/STU-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    const inserted = [];
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.name) {
        throw new Error(`Row ${i + 1}: Name is required`);
      }

      const className = (s.class_name || s.className || '').toLowerCase().trim();
      const classId = classMap[className] || null;

      // Access control for teacher role
      if (role === 'Teacher') {
        if (!classId) {
          throw new Error(`Row ${i + 1} ("${s.name}"): Class "${s.class_name || ''}" not found or you do not have permission.`);
        }
        if (!assignedClassIds.includes(classId)) {
          throw new Error(`Row ${i + 1} ("${s.name}"): Access Denied to class "${s.class_name}".`);
        }
      }

      // Generate unique STU-XXX ID sequential
      const studentId = `STU-${String(nextNum + i).padStart(3, '0')}`;

      const { rows } = await query(
        `INSERT INTO students (student_id, name, class_id, age, gender, phone, guardian, guardian_phone, address, date_of_birth)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, student_id, name`,
        [
          studentId,
          s.name,
          classId,
          s.age ? parseInt(s.age) : null,
          s.gender || null,
          s.phone || null,
          s.guardian || null,
          s.guardian_phone || s.guardianPhone || null,
          s.address || null,
          s.date_of_birth || s.dateOfBirth || null
        ]
      );
      inserted.push(rows[0]);
    }

    await query('COMMIT');
    res.json({ message: `Successfully imported ${inserted.length} students`, students: inserted });
  } catch (err) {
    await query('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
});

// POST /api/students
router.post('/', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  let { studentId, name, classId, age, gender, phone, guardian, guardianPhone, address, dateOfBirth } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Auto-generate student_id if omitted or empty
  if (!studentId) {
    try {
      const lastStudent = await query(
        `SELECT student_id FROM students 
         WHERE student_id LIKE 'STU-%' 
         ORDER BY student_id DESC LIMIT 1`
      );
      let nextNum = 1;
      if (lastStudent.rows.length) {
        const match = lastStudent.rows[0].student_id.match(/STU-(\d+)/);
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }
      studentId = `STU-${String(nextNum).padStart(3, '0')}`;
    } catch (err) {
      console.error('Error generating student ID:', err);
      return res.status(500).json({ error: 'Could not auto-generate student ID' });
    }
  }

  const { role, assignedClassIds } = req.userContext;
  if (role === 'Teacher' && (!classId || !assignedClassIds.includes(parseInt(classId)))) {
    return res.status(403).json({ error: 'Access denied. You can only add students to your assigned classes.' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO students (student_id,name,class_id,age,gender,phone,guardian,guardian_phone,address,date_of_birth)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [studentId, name, classId||null, age||null, gender||null, phone||null, guardian||null, guardianPhone||null, address||null, dateOfBirth||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Student ID already exists' });
    throw err;
  }
});

// PUT /api/students/:id
router.put('/:id', authenticate, authorize('Admin','Teacher'), async (req, res) => {
  const { name, classId, age, gender, phone, guardian, guardianPhone, address, dateOfBirth } = req.body;

  // Enforce access control for update
  const { rows: currentStudent } = await query('SELECT class_id FROM students WHERE id=$1', [req.params.id]);
  if (!currentStudent.length) return res.status(404).json({ error: 'Student not found' });
  
  const { role, assignedClassIds } = req.userContext;
  if (role === 'Teacher') {
    // Cannot edit student if they are not currently in one of their classes
    if (!assignedClassIds.includes(currentStudent[0].class_id)) {
      return res.status(403).json({ error: 'Access denied. You are not assigned to this student\'s class.' });
    }
    // Cannot move student to a class they are not assigned to
    if (classId && !assignedClassIds.includes(parseInt(classId))) {
      return res.status(403).json({ error: 'Access denied. You can only assign students to your own classes.' });
    }
  }

  const { rows } = await query(
    `UPDATE students SET name=$1,class_id=$2,age=$3,gender=$4,phone=$5,
     guardian=$6,guardian_phone=$7,address=$8,date_of_birth=$9 WHERE id=$10 RETURNING *`,
    [name, classId||null, age||null, gender||null, phone||null, guardian||null, guardianPhone||null, address||null, dateOfBirth||null, req.params.id]
  );
  res.json(rows[0]);
});

// DELETE /api/students/:id
router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const { rows } = await query('DELETE FROM students WHERE id=$1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Student not found' });
  res.json({ message: 'Student deleted' });
});

module.exports = router;
