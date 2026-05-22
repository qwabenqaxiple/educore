-- EduCore SMS — Seed Data
-- Passwords are bcrypt hashes of the plaintext shown in comments

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Admin: admin123 | Teacher: teach123 | Student: stud123 | Parent: par123
INSERT INTO users (name, email, password, role, phone, avatar) VALUES
  ('Dr. Tei Ezekeil',  'admin@educore.edu',   '$2b$10$YourHashHereAdmin000000000000000000000000000', 'Admin',   '055-000-0001', 'TE'),
  ('Mrs. Efua Mensah',  'teacher@educore.edu', '$2b$10$YourHashHereTeach000000000000000000000000000', 'Teacher', '055-000-0002', 'EM'),
  ('Kofi Boateng',      'student@educore.edu', '$2b$10$YourHashHereStud0000000000000000000000000000', 'Student', '055-000-0003', 'KB'),
  ('Mrs. Ama Boateng',  'parent@educore.edu',  '$2b$10$YourHashHerePar00000000000000000000000000000', 'Parent',  '055-000-0004', 'AB')
ON CONFLICT (email) DO NOTHING;

-- NOTE: Run `node backend/scripts/hash-passwords.js` to generate real bcrypt hashes
-- then UPDATE users SET password = '<hash>' WHERE email = '<email>';

-- ─── Classes ─────────────────────────────────────────────────────────────────
INSERT INTO classes (name, level, capacity) VALUES
  ('Nursery 1A',  'Nursery', 30),
  ('Nursery 1B',  'Nursery', 30),
  ('Nursery 2A',  'Nursery', 30),
  ('Nursery 2B',  'Nursery', 30),
  ('KG 1',        'KG',      35),
  ('KG 2',        'KG',      35),
  ('Form 1A', 'JHS', 40),
  ('Form 2B', 'JHS', 38),
  ('Form 3A', 'JHS', 35)
ON CONFLICT DO NOTHING;

-- ─── Subjects ────────────────────────────────────────────────────────────────
INSERT INTO subjects (name, code) VALUES
  ('Mathematics',        'MATH'),
  ('English Language',   'ENG'),
  ('Integrated Science', 'SCI'),
  ('Social Studies',     'SOC'),
  ('ICT',                'ICT')
ON CONFLICT (code) DO NOTHING;

-- Assign subjects to classes
INSERT INTO subject_classes (subject_id, class_id)
SELECT s.id, c.id FROM subjects s, classes c
WHERE s.code IN ('MATH','ENG','SOC') AND c.name IN ('Form 1A','Form 2B','Form 3A')
ON CONFLICT DO NOTHING;

INSERT INTO subject_classes (subject_id, class_id)
SELECT s.id, c.id FROM subjects s, classes c
WHERE s.code = 'SCI' AND c.name IN ('Form 1A','Form 2B')
ON CONFLICT DO NOTHING;

INSERT INTO subject_classes (subject_id, class_id)
SELECT s.id, c.id FROM subjects s, classes c
WHERE s.code = 'ICT' AND c.name IN ('Form 2B','Form 3A')
ON CONFLICT DO NOTHING;

-- ─── Teachers ────────────────────────────────────────────────────────────────
INSERT INTO teachers (staff_id, name, email, phone, gender, qualification) VALUES
  ('TCH-001', 'Mrs. Efua Mensah',    'teacher@educore.edu',  '055-000-0002', 'Female', 'B.Ed Mathematics'),
  ('TCH-002', 'Mr. Ebo Quansah',     'equansah@educore.edu', '055-333-002',  'Male',   'B.Sc Science'),
  ('TCH-003', 'Ms. Abena Frimpong',  'afrimpong@educore.edu','055-333-003',  'Female', 'B.A Social Studies')
ON CONFLICT (email) DO NOTHING;

-- ─── Students ────────────────────────────────────────────────────────────────
INSERT INTO students (student_id, name, class_id, age, gender, phone, guardian, guardian_phone, address)
SELECT 'STU-001','Kofi Boateng',    c.id, 14,'Male',  '055-111-001','Mrs. Ama Boateng',   '055-000-0004','Accra'      FROM classes c WHERE c.name='Form 1A' ON CONFLICT DO NOTHING;
INSERT INTO students (student_id, name, class_id, age, gender, phone, guardian, guardian_phone, address)
SELECT 'STU-002','Akosua Darko',    c.id, 13,'Female','055-111-002','Mr. Ben Darko',       '055-222-002', 'Kumasi'     FROM classes c WHERE c.name='Form 1A' ON CONFLICT DO NOTHING;
INSERT INTO students (student_id, name, class_id, age, gender, phone, guardian, guardian_phone, address)
SELECT 'STU-003','Yaw Asante',      c.id, 15,'Male',  '055-111-003','Mrs. Grace Asante',   '055-222-003', 'Takoradi'   FROM classes c WHERE c.name='Form 2B' ON CONFLICT DO NOTHING;
INSERT INTO students (student_id, name, class_id, age, gender, phone, guardian, guardian_phone, address)
SELECT 'STU-004','Abena Osei',      c.id, 14,'Female','055-111-004','Mr. Paul Osei',        '055-222-004', 'Cape Coast' FROM classes c WHERE c.name='Form 2B' ON CONFLICT DO NOTHING;
INSERT INTO students (student_id, name, class_id, age, gender, phone, guardian, guardian_phone, address)
SELECT 'STU-005','Kojo Antwi',      c.id, 16,'Male',  '055-111-005','Mrs. Rita Antwi',      '055-222-005', 'Tamale'     FROM classes c WHERE c.name='Form 3A' ON CONFLICT DO NOTHING;
