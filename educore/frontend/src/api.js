// src/api.js — Centralized API client for EduCore SMS
const BASE = import.meta.env.VITE_API_URL
  || (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:5000/api');

// ─── Token helpers ────────────────────────────────────────────────────────────
export const getToken  = ()      => localStorage.getItem('educore_token');
export const setToken  = (token) => localStorage.setItem('educore_token', token);
export const clearToken = ()     => localStorage.removeItem('educore_token');

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const get    = (path)        => req('GET',    path);
const post   = (path, body)  => req('POST',   path, body);
const put    = (path, body)  => req('PUT',    path, body);
const del    = (path)        => req('DELETE', path);
const params = (obj)         => '?' + new URLSearchParams(
  Object.fromEntries(Object.entries(obj).filter(([,v]) => v != null && v !== ''))
).toString();

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  login:          (email, password)  => post('/auth/login', { email, password }),
  register:       (data)             => post('/auth/register', data),
  me:             ()                 => get('/auth/me'),
  config:         ()                 => get('/auth/config'),
  changePassword: (cur, next)        => put('/auth/password', { currentPassword: cur, newPassword: next }),
  forgotPassword: (email)            => post('/auth/forgot-password', { email }),
};

// ─── Students ─────────────────────────────────────────────────────────────────
export const students = {
  list:   (filter = {}) => get(`/students${params(filter)}`),
  get:    (id)          => get(`/students/${id}`),
  create: (data)        => post('/students', data),
  update: (id, data)    => put(`/students/${id}`, data),
  delete: (id)          => del(`/students/${id}`),
};

// ─── Teachers ─────────────────────────────────────────────────────────────────
export const teachers = {
  list:   ()         => get('/teachers'),
  get:    (id)       => get(`/teachers/${id}`),
  create: (data)     => post('/teachers', data),
  update: (id, data) => put(`/teachers/${id}`, data),
  delete: (id)       => del(`/teachers/${id}`),
};

// ─── Classes ──────────────────────────────────────────────────────────────────
export const classes = {
  list:   ()         => get('/classes'),
  create: (data)     => post('/classes', data),
  update: (id, data) => put(`/classes/${id}`, data),
  delete: (id)       => del(`/classes/${id}`),
};

// ─── Subjects ─────────────────────────────────────────────────────────────────
export const subjects = {
  list:   ()         => get('/subjects'),
  create: (data)     => post('/subjects', data),
  update: (id, data) => put(`/subjects/${id}`, data),
  delete: (id)       => del(`/subjects/${id}`),
};

// ─── Attendance ───────────────────────────────────────────────────────────────
export const attendance = {
  list:      (filter = {}) => get(`/attendance${params(filter)}`),
  markBulk:  (classId, date, records) => post('/attendance/bulk', { classId, date, records }),
  update:    (id, data)    => put(`/attendance/${id}`, data),
  delete:    (id)          => del(`/attendance/${id}`),
  report:    (classId, start, end)    => get(`/attendance/report${params({ classId, startDate:start, endDate:end })}`),
};

// ─── Exams & Results ──────────────────────────────────────────────────────────
export const exams = {
  list:        (filter = {}) => get(`/exams${params(filter)}`),
  create:      (data)        => post('/exams', data),
  update:      (id, data)    => put(`/exams/${id}`, data),
  delete:      (id)          => del(`/exams/${id}`),
  results:     (filter = {}) => get(`/exams/results${params(filter)}`),
  saveScores:  (examId, scores) => post('/exams/results/bulk', { examId, scores }),
  reportCard:  (studentId)      => get(`/exams/report-card/${studentId}`),
};

// ─── Fees ─────────────────────────────────────────────────────────────────────
export const fees = {
  list:    (filter = {}) => get(`/fees${params(filter)}`),
  create:  (data)        => post('/fees', data),
  update:  (id, data)    => put(`/fees/${id}`, data),
  delete:  (id)          => del(`/fees/${id}`),
  remind:  (id)          => post(`/fees/${id}/remind`),
  summary: ()            => get('/fees/summary'),
};

// ─── Timetable ────────────────────────────────────────────────────────────────
export const timetable = {
  list:   (classId)  => get(`/timetable${params({ classId })}`),
  create: (data)     => post('/timetable', data),
  update: (id, data) => put(`/timetable/${id}`, data),
  delete: (id)       => del(`/timetable/${id}`),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = {
  list:    ()   => get('/notifications'),
  read:    (id) => put(`/notifications/${id}/read`),
  readAll: ()   => put('/notifications/read-all'),
  delete:  (id) => del(`/notifications/${id}`),
  send:    (data) => post('/notifications', data),
  listSent: ()  => get('/notifications/sent'),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = {
  list:   ()         => get('/users'),
  create: (data)     => post('/users', data),
  update: (id, data) => put(`/users/${id}`, data),
  delete: (id)       => del(`/users/${id}`),
  logins: ()         => get('/users/logins'),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reports = {
  dashboard:  ()              => get('/reports/dashboard'),
  attendance: (filter = {})  => get(`/reports/attendance${params(filter)}`),
  fees:       (filter = {})  => get(`/reports/fees${params(filter)}`),
  results:    (filter = {})  => get(`/reports/results${params(filter)}`),
};
