-- EduCore SMS — PostgreSQL Schema
-- Run: psql -U postgres -d educore -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  email       VARCHAR(120) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,   -- bcrypt hash
  role        VARCHAR(20) NOT NULL CHECK (role IN ('Admin','Teacher','Student','Parent')),
  phone       VARCHAR(30),
  avatar      VARCHAR(10),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Classes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL,
  level       VARCHAR(30) NOT NULL,
  capacity    INT DEFAULT 40,
  teacher_id  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Subjects ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subject_classes (
  subject_id  INT REFERENCES subjects(id) ON DELETE CASCADE,
  class_id    INT REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, class_id)
);

-- ─── Students ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id              SERIAL PRIMARY KEY,
  student_id      VARCHAR(30) UNIQUE NOT NULL,
  name            VARCHAR(120) NOT NULL,
  class_id        INT REFERENCES classes(id) ON DELETE SET NULL,
  age             INT,
  gender          VARCHAR(10) CHECK (gender IN ('Male','Female')),
  phone           VARCHAR(30),
  guardian        VARCHAR(120),
  guardian_phone  VARCHAR(30),
  address         TEXT,
  date_of_birth   DATE,
  user_id         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Teachers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id              SERIAL PRIMARY KEY,
  staff_id        VARCHAR(30) UNIQUE NOT NULL,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(120) UNIQUE NOT NULL,
  phone           VARCHAR(30),
  gender          VARCHAR(10) CHECK (gender IN ('Male','Female')),
  qualification   VARCHAR(120),
  user_id         INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id  INT REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id  INT REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS teacher_classes (
  teacher_id  INT REFERENCES teachers(id) ON DELETE CASCADE,
  class_id    INT REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, class_id)
);

-- ─── Attendance ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          SERIAL PRIMARY KEY,
  student_id  INT REFERENCES students(id) ON DELETE CASCADE,
  class_id    INT REFERENCES classes(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      VARCHAR(15) NOT NULL CHECK (status IN ('Present','Absent','Late')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, class_id, date)
);

-- ─── Exams ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  term         VARCHAR(20) NOT NULL,
  year         VARCHAR(10) NOT NULL,
  class_id     INT REFERENCES classes(id) ON DELETE CASCADE,
  subject_id   INT REFERENCES subjects(id) ON DELETE CASCADE,
  date         DATE,
  total_marks  INT DEFAULT 100,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS results (
  id          SERIAL PRIMARY KEY,
  exam_id     INT REFERENCES exams(id) ON DELETE CASCADE,
  student_id  INT REFERENCES students(id) ON DELETE CASCADE,
  score       NUMERIC(5,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (exam_id, student_id)
);

-- ─── Fees ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fees (
  id          SERIAL PRIMARY KEY,
  student_id  INT REFERENCES students(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  paid        NUMERIC(10,2) DEFAULT 0,
  term        VARCHAR(20) NOT NULL,
  year        VARCHAR(10) NOT NULL,
  date        DATE,
  method      VARCHAR(40),
  receipt_no  VARCHAR(30) UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Timetable ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable (
  id          SERIAL PRIMARY KEY,
  class_id    INT REFERENCES classes(id) ON DELETE CASCADE,
  subject_id  INT REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id  INT REFERENCES teachers(id) ON DELETE SET NULL,
  day         VARCHAR(15) NOT NULL CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  period      INT NOT NULL CHECK (period BETWEEN 1 AND 8),
  start_time  TIME,
  end_time    TIME,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_id, day, period)
);

-- ─── Notifications ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  type        VARCHAR(30) DEFAULT 'info',
  read        BOOLEAN DEFAULT FALSE,
  sender_id   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_student  ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date     ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_results_student     ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_student        ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_students_class      ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id);

-- ─── Login Logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  email       VARCHAR(120) NOT NULL,
  role        VARCHAR(20) NOT NULL,
  ip_address  VARCHAR(50),
  user_agent  TEXT,
  login_time  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
