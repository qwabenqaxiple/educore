# 🎓 EduCore SMS — Full-Stack School Management System

A complete, production-ready School Management System with a React frontend, Node.js/Express backend, and PostgreSQL database.

---

## 🏗 Project Structure

```
educore/
├── backend/                # Express API
│   ├── db/
│   │   ├── pool.js         # PostgreSQL connection pool
│   │   ├── schema.sql      # Database schema
│   │   ├── seed.sql        # Sample data (SQL)
│   │   └── seeder.js       # Programmatic seeder (with bcrypt)
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication + role guard
│   │   └── notify.js       # Email alerts + in-app notifications
│   ├── routes/
│   │   ├── auth.js         # Login, register, /me
│   │   ├── students.js     # CRUD + search/filter
│   │   ├── teachers.js     # CRUD + subject/class assignments
│   │   ├── classes.js      # CRUD
│   │   ├── subjects.js     # CRUD + class assignments
│   │   ├── attendance.js   # Bulk mark + report + email alerts
│   │   ├── exams.js        # CRUD + bulk score entry + report cards
│   │   ├── fees.js         # CRUD + reminders + summary
│   │   ├── timetable.js    # CRUD + conflict detection
│   │   ├── notifications.js# In-app notification management
│   │   ├── users.js        # Admin user management
│   │   └── reports.js      # Dashboard stats + printable reports
│   ├── .env.example        # Environment variable template
│   ├── Dockerfile
│   ├── package.json
│   └── server.js           # Express app entry point
│
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── api.js          # Centralized API client
│   │   ├── App.jsx         # Main app (all modules)
│   │   └── main.jsx        # React entry point
│   ├── .env.example
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf          # Production Nginx config
│   ├── package.json
│   ├── vercel.json         # Vercel deployment config
│   └── vite.config.js
│
├── docker-compose.yml      # One-command local stack
└── render.yaml             # Render.com deployment config
```

---

## 🚀 Quick Start — Local Development

### Option A: Docker (recommended, zero setup)

```bash
# 1. Clone / enter the project
cd educore

# 2. Start everything (Postgres + API + Frontend)
docker compose up --build

# 3. Seed the database
docker compose exec api node db/seeder.js

# 4. Open http://localhost:3000
```

### Option B: Manual Setup

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+

#### 1. Database
```bash
createdb educore
psql -U postgres -d educore -f backend/db/schema.sql
```

#### 2. Backend
```bash
cd backend
cp .env.example .env          # Fill in your DATABASE_URL, JWT_SECRET
npm install
node db/seeder.js             # Seeds demo users + sample data
npm run dev                   # Runs on http://localhost:5000
```

#### 3. Frontend
```bash
cd frontend
cp .env.example .env          # Set VITE_API_URL if needed
npm install
npm run dev                   # Runs on http://localhost:3000
```

---

## 🔐 Demo Credentials

| Role    | Email                    | Password   |
|---------|--------------------------|------------|
| Admin   | admin@educore.edu        | admin123   |
| Teacher | teacher@educore.edu      | teach123   |
| Student | student@educore.edu      | stud123    |
| Parent  | parent@educore.edu       | par123     |

---

## 📡 API Reference

All endpoints require `Authorization: Bearer <token>` unless noted.

| Method | Endpoint                        | Description                     | Roles             |
|--------|---------------------------------|---------------------------------|-------------------|
| POST   | /api/auth/login                 | Login → JWT token               | Public            |
| POST   | /api/auth/register              | Create account                  | Public            |
| GET    | /api/auth/me                    | Current user                    | All               |
| GET    | /api/students                   | List students (search, filter)  | Admin, Teacher    |
| POST   | /api/students                   | Add student                     | Admin, Teacher    |
| PUT    | /api/students/:id               | Update student                  | Admin, Teacher    |
| DELETE | /api/students/:id               | Delete student                  | Admin             |
| GET    | /api/teachers                   | List teachers                   | All               |
| POST   | /api/teachers                   | Add teacher                     | Admin             |
| GET    | /api/classes                    | List classes (with student count)| All              |
| GET    | /api/subjects                   | List subjects                   | All               |
| GET    | /api/attendance                 | List records (filter by class/date)| All            |
| POST   | /api/attendance/bulk            | Mark attendance for whole class | Admin, Teacher    |
| GET    | /api/attendance/report          | Attendance summary per student  | Admin, Teacher    |
| GET    | /api/exams                      | List exams                      | All               |
| POST   | /api/exams/results/bulk         | Save exam scores                | Admin, Teacher    |
| GET    | /api/exams/report-card/:studentId| Student report card            | All               |
| GET    | /api/fees                       | List fee records                | Admin, Parent     |
| POST   | /api/fees                       | Record fee payment              | Admin             |
| POST   | /api/fees/:id/remind            | Send fee reminder email         | Admin             |
| GET    | /api/fees/summary               | Total billed/collected/outstanding| Admin           |
| GET    | /api/timetable                  | Get timetable for a class       | All               |
| POST   | /api/timetable                  | Add timetable slot              | Admin             |
| GET    | /api/reports/dashboard          | Dashboard stats                 | All               |
| GET    | /api/reports/attendance         | Full attendance report          | Admin, Teacher    |
| GET    | /api/reports/fees               | Full fee report                 | Admin             |
| GET    | /api/reports/results            | Full results report             | Admin, Teacher    |
| GET    | /api/notifications              | User's notifications            | All               |

---

## ☁️ Deployment

### Frontend → Vercel (free)

```bash
cd frontend
npm install -g vercel
vercel

# Set environment variable in Vercel dashboard:
# VITE_API_URL = https://your-backend.onrender.com/api
```

### Backend + Database → Render.com (free tier)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your repo → select `render.yaml`
4. Render auto-creates the PostgreSQL DB + Web Service
5. After deploy, run the seeder:
   ```bash
   # In Render dashboard → Shell
   node db/seeder.js
   ```

### Alternative: Railway.app (one-click)
```bash
npm install -g @railway/cli
railway login
railway init
railway add postgresql
railway up
```

---

## 📧 Email Notifications

Set these in `backend/.env` to enable email alerts:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourschool@gmail.com
SMTP_PASS=your-gmail-app-password   # Not your Gmail password!
EMAIL_FROM=EduCore SMS <noreply@yourschool.edu>
```

For Gmail: Google Account → Security → 2-Step Verification → App Passwords → Generate.

Email alerts are sent automatically when:
- A student is marked **Absent** or **Late** → guardian notified
- **Exam results** are saved → guardian/student notified
- Admin clicks **📧 Remind** on an outstanding fee record

---

## 🔔 Extending the System

### Add SMS Alerts (Twilio)
```bash
cd backend && npm install twilio
```
```js
// In middleware/notify.js
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
await twilio.messages.create({
  body: `Attendance alert: ${student.name} was ${status} on ${date}`,
  from: process.env.TWILIO_PHONE,
  to: student.guardian_phone,
});
```

### Add Library Module
1. Add `library_books` and `library_loans` tables to `schema.sql`
2. Create `backend/routes/library.js`
3. Register in `server.js`: `app.use('/api/library', require('./routes/library'))`
4. Add `Lib` component to `frontend/src/App.jsx`

### Add Parent Portal
- Parents already have role-restricted access in the current system
- They can see: their child's attendance, exam results, fee balance
- Extend by adding a `parent_students` table for multi-child support

---

## 🛡 Security Notes

- Passwords hashed with **bcrypt** (10 rounds)
- JWT tokens expire in **7 days** (configurable)
- Rate limiting: 20 login attempts / 15 min; 200 API calls / min
- Helmet.js sets secure HTTP headers
- Role-based access on every route
- SQL injection prevented via parameterized queries (pg library)
- **Change `JWT_SECRET` in production** to a 64+ character random string:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
