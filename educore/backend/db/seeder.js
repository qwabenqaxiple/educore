// db/seeder.js — Programmatic seed with real bcrypt hashes
require('../loadEnv');
const bcrypt = require('bcryptjs');
const { query } = require('./pool');
const fs = require('fs');
const path = require('path');

async function seed() {
  console.log('🌱 Seeding EduCore database...\n');

  // 1. Drop existing tables for a clean rebuild
  console.log('🗑 Dropping existing tables for a clean rebuild...');
  await query(`
    DROP TABLE IF EXISTS timetable CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS fees CASCADE;
    DROP TABLE IF EXISTS results CASCADE;
    DROP TABLE IF EXISTS exams CASCADE;
    DROP TABLE IF EXISTS attendance CASCADE;
    DROP TABLE IF EXISTS teacher_classes CASCADE;
    DROP TABLE IF EXISTS teacher_subjects CASCADE;
    DROP TABLE IF EXISTS teachers CASCADE;
    DROP TABLE IF EXISTS students CASCADE;
    DROP TABLE IF EXISTS subject_classes CASCADE;
    DROP TABLE IF EXISTS subjects CASCADE;
    DROP TABLE IF EXISTS classes CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);
  console.log('✅ Tables dropped');

  // 2. Run schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(schema);
  console.log('✅ Schema applied');

  // 2. Hash passwords
  const isProd = process.env.APP_ENV === 'production';
  const USERS = isProd ? [
    { name: 'Tei Ezekiel', email: 'teiezekiel131@gmail.com', password: 'xiple@2020', role: 'Admin', phone: '055-000-0000', avatar: 'TE' },
  ] : [
    { name: 'Tei Ezekiel', email: 'teiezekiel131@gmail.com', password: 'xiple@2020', role: 'Admin', phone: '055-000-0000', avatar: 'TE' },
    { name: 'Dr. Ezekiel Tei', email: 'admin@educore.edu', password: 'admin123', role: 'Admin', phone: '055-000-0001', avatar: 'TE' },
    { name: 'Mrs. Efua Mensah', email: 'teacher@educore.edu', password: 'teach123', role: 'Teacher', phone: '055-000-0002', avatar: 'EM' },
    { name: 'Kofi Boateng', email: 'student@educore.edu', password: 'stud123', role: 'Student', phone: '055-000-0003', avatar: 'KB' },
    { name: 'Mrs. Ama Boateng', email: 'parent@educore.edu', password: 'par123', role: 'Parent', phone: '055-000-0004', avatar: 'AB' },
  ];

  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await query(
      `INSERT INTO users (name,email,password,role,phone,avatar)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET password=$3`,
      [u.name, u.email, hash, u.role, u.phone, u.avatar]
    );
  }
  console.log(isProd ? '✅ Users seeded (Live Admin)' : '✅ Users seeded (Admin / Teacher / Student / Parent)');

  // 3. Classes
  const CLASSES = [
    { name: 'Form 1A', level: 'JHS', capacity: 40 },
    { name: 'Form 2B', level: 'JHS', capacity: 38 },
    { name: 'Form 3A', level: 'JHS', capacity: 35 },
  ];
  for (const c of CLASSES) {
    await query(
      `INSERT INTO classes (name,level,capacity) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [c.name, c.level, c.capacity]
    );
  }
  console.log('✅ Classes seeded');

  // 4. Subjects
  const SUBJECTS = [
    { name: 'Mathematics', code: 'MATH' },
    { name: 'English Language', code: 'ENG' },
    { name: 'Integrated Science', code: 'SCI' },
    { name: 'Social Studies', code: 'SOC' },
    { name: 'ICT', code: 'ICT' },
  ];
  for (const s of SUBJECTS) {
    await query(
      `INSERT INTO subjects (name,code) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING`,
      [s.name, s.code]
    );
  }
  console.log('✅ Subjects seeded');

  // 5. Teachers
  if (isProd) {
    console.log('⏭ Skipping demo teachers in production mode');
  } else {
    const TEACHERS = [
      { staffId: 'TCH-001', name: 'Mrs. Efua Mensah', email: 'teacher@educore.edu', phone: '055-000-0002', gender: 'Female', qualification: 'B.Ed Mathematics' },
      { staffId: 'TCH-002', name: 'Mr. Ebo Quansah', email: 'equansah@educore.edu', phone: '055-333-002', gender: 'Male', qualification: 'B.Sc Science' },
      { staffId: 'TCH-003', name: 'Ms. Abena Frimpong', email: 'afrimpong@educore.edu', phone: '055-333-003', gender: 'Female', qualification: 'B.A Social Studies' },
    ];
    for (const t of TEACHERS) {
      await query(
        `INSERT INTO teachers (staff_id,name,email,phone,gender,qualification)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
        [t.staffId, t.name, t.email, t.phone, t.gender, t.qualification]
      );
    }
    console.log('✅ Teachers seeded');
  }

  // 6. Students
  if (isProd) {
    console.log('⏭ Skipping demo students in production mode');
  } else {
    const { rows: cls } = await query('SELECT id,name FROM classes');
    const clsMap = Object.fromEntries(cls.map(c => [c.name, c.id]));

    const STUDENTS = [
      { sid: 'STU-001', name: 'Kofi Boateng', cls: 'Form 1A', age: 14, gender: 'Male', phone: '055-111-001', guardian: 'Mrs. Ama Boateng', gPhone: '055-000-0004', addr: 'Accra', dob: '2012-05-15' },
      { sid: 'STU-002', name: 'Akosua Darko', cls: 'Form 1A', age: 13, gender: 'Female', phone: '055-111-002', guardian: 'Mr. Ben Darko', gPhone: '055-222-002', addr: 'Kumasi', dob: '2013-08-20' },
      { sid: 'STU-003', name: 'Yaw Asante', cls: 'Form 2B', age: 15, gender: 'Male', phone: '055-111-003', guardian: 'Mrs. Grace Asante', gPhone: '055-222-003', addr: 'Takoradi', dob: '2011-03-10' },
      { sid: 'STU-004', name: 'Abena Osei', cls: 'Form 2B', age: 14, gender: 'Female', phone: '055-111-004', guardian: 'Mr. Paul Osei', gPhone: '055-222-004', addr: 'Cape Coast', dob: '2012-11-05' },
      { sid: 'STU-005', name: 'Kojo Antwi', cls: 'Form 3A', age: 16, gender: 'Male', phone: '055-111-005', guardian: 'Mrs. Rita Antwi', gPhone: '055-222-005', addr: 'Tamale', dob: '2010-01-25' },
    ];
    for (const s of STUDENTS) {
      await query(
        `INSERT INTO students (student_id,name,class_id,age,gender,phone,guardian,guardian_phone,address,date_of_birth)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (student_id) DO NOTHING`,
        [s.sid, s.name, clsMap[s.cls], s.age, s.gender, s.phone, s.guardian, s.gPhone, s.addr, s.dob]
      );
    }
    console.log('✅ Students seeded');
  }

  // 7. Link seeded teachers and students to their user IDs
  if (!isProd) {
    await query(`
      UPDATE teachers t
      SET user_id = u.id
      FROM users u
      WHERE t.email = u.email AND u.role = 'Teacher'
    `);
    await query(`
      UPDATE students s
      SET user_id = u.id
      FROM users u
      WHERE s.name = u.name AND u.role = 'Student'
    `);
    console.log('✅ Linked teachers and students to their corresponding user IDs');
  }

  // 8. Link demo teacher (Mrs. Efua Mensah) to subjects and classes
  if (!isProd) {
    const { rows: tRows } = await query("SELECT id FROM teachers WHERE email = 'teacher@educore.edu'");
    if (tRows.length) {
      const efuaId = tRows[0].id;
      const { rows: sRows } = await query("SELECT id FROM subjects WHERE code IN ('MATH', 'ENG')");
      for (const s of sRows) {
        await query("INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [efuaId, s.id]);
      }
      const { rows: cRows } = await query("SELECT id FROM classes WHERE name IN ('Form 1A', 'Form 2B')");
      for (const c of cRows) {
        await query("INSERT INTO teacher_classes (teacher_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [efuaId, c.id]);
      }
      console.log('✅ Seeded class and subject assignments for demo teacher');
    }
  }

  console.log('\n🎉 Database seeding complete!');
  console.log('─────────────────────────────────────────');
  if (isProd) {
    console.log('Production credentials:');
    console.log('  Admin:   teiezekiel131@gmail.com   / xiple@2020');
  } else {
    console.log('Demo credentials:');
    console.log('  Admin (Live): teiezekiel131@gmail.com / xiple@2020');
    console.log('  Admin:        admin@educore.edu       / admin123');
    console.log('  Teacher:      teacher@educore.edu     / teach123');
    console.log('  Student:      student@educore.edu     / stud123');
    console.log('  Parent:       parent@educore.edu      / par123');
  }
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
