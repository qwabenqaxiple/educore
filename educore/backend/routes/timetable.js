// routes/timetable.js
const router = require('express').Router();
const { query } = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  const { classId } = req.query;
  const { role, assignedClassIds, studentId, classId: studentClassId, childClassIds } = req.userContext;

  let sql = `
    SELECT t.*, c.name AS class_name, s.name AS subject_name, te.name AS teacher_name
    FROM timetable t
    LEFT JOIN classes  c  ON c.id=t.class_id
    LEFT JOIN subjects s  ON s.id=t.subject_id
    LEFT JOIN teachers te ON te.id=t.teacher_id
    WHERE 1=1`;
  const params = [];

  if (role === 'Teacher') {
    if (classId) {
      const cId = parseInt(classId, 10);
      if (!assignedClassIds.includes(cId)) {
        return res.status(403).json({ error: 'Access denied. You are not assigned to this class.' });
      }
      params.push(cId);
      sql += ` AND t.class_id = $${params.length}`;
    } else {
      if (!assignedClassIds || assignedClassIds.length === 0) {
        if (req.userContext.teacherId) {
          params.push(req.userContext.teacherId);
          sql += ` AND t.teacher_id = $${params.length}`;
        } else {
          return res.json([]);
        }
      } else {
        const classIdsPlaceholder = assignedClassIds.map((_, i) => `$${params.length + i + 1}`).join(',');
        assignedClassIds.forEach(id => params.push(id));
        
        if (req.userContext.teacherId) {
          params.push(req.userContext.teacherId);
          sql += ` AND (t.class_id IN (${classIdsPlaceholder}) OR t.teacher_id = $${params.length})`;
        } else {
          sql += ` AND t.class_id IN (${classIdsPlaceholder})`;
        }
      }
    }
  } else if (role === 'Student') {
    if (!studentClassId) {
      return res.json([]);
    }
    if (classId && parseInt(classId, 10) !== studentClassId) {
      return res.status(403).json({ error: 'Access denied. You can only view your own class timetable.' });
    }
    params.push(studentClassId);
    sql += ` AND t.class_id = $${params.length}`;
  } else if (role === 'Parent') {
    if (!childClassIds || childClassIds.length === 0) {
      return res.json([]);
    }
    if (classId) {
      const cId = parseInt(classId, 10);
      if (!childClassIds.includes(cId)) {
        return res.status(403).json({ error: 'Access denied. You can only view your children\'s timetables.' });
      }
      params.push(cId);
      sql += ` AND t.class_id = $${params.length}`;
    } else {
      const classIdsPlaceholder = childClassIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      childClassIds.forEach(id => params.push(id));
      sql += ` AND t.class_id IN (${classIdsPlaceholder})`;
    }
  } else {
    if (classId) {
      params.push(classId);
      sql += ` AND t.class_id = $${params.length}`;
    }
  }

  sql += ' ORDER BY t.day, t.period';
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.post('/', authenticate, authorize('Admin'), async (req, res) => {
  const { classId, subjectId, teacherId, day, period, startTime, endTime } = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO timetable (class_id,subject_id,teacher_id,day,period,start_time,end_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [classId, subjectId||null, teacherId||null, day, period, startTime||null, endTime||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This slot is already occupied' });
    throw err;
  }
});

router.put('/:id', authenticate, authorize('Admin'), async (req, res) => {
  const { subjectId, teacherId, day, period, startTime, endTime } = req.body;
  const { rows } = await query(
    `UPDATE timetable SET subject_id=$1,teacher_id=$2,day=$3,period=$4,start_time=$5,end_time=$6
     WHERE id=$7 RETURNING *`,
    [subjectId||null, teacherId||null, day, period, startTime||null, endTime||null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  await query('DELETE FROM timetable WHERE id=$1', [req.params.id]);
  res.json({ message: 'Slot removed' });
});

module.exports = router;
