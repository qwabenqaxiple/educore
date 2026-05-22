// middleware/notify.js — Email + in-app notifications
const nodemailer = require('nodemailer');
const { query } = require('../db/pool');

// ─── Email Transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST  || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Send Email ───────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL SKIPPED — no SMTP configured] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'EduCore SMS <noreply@educore.edu>',
      to, subject, html, text,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

// ─── In-App Notification ──────────────────────────────────────────────────────
const createNotification = async (userId, title, message, type = 'info') => {
  try {
    await query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES ($1,$2,$3,$4)`,
      [userId, title, message, type]
    );
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

// ─── Fee Reminder ─────────────────────────────────────────────────────────────
const sendFeeReminder = async (student, feeRecord) => {
  const balance = feeRecord.amount - feeRecord.paid;
  await sendEmail({
    to: student.guardian_email || student.email,
    subject: `Fee Reminder — EduCore SMS`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px">
        <h2 style="color:#1d4ed8">📚 EduCore School Management System</h2>
        <p>Dear <strong>${student.guardian}</strong>,</p>
        <p>This is a reminder that <strong>${student.name}</strong> has an outstanding fee balance:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#e0e7ff;font-weight:bold">Term</td><td style="padding:8px">${feeRecord.term} ${feeRecord.year}</td></tr>
          <tr><td style="padding:8px;background:#e0e7ff;font-weight:bold">Total Fee</td><td style="padding:8px">₵${feeRecord.amount}</td></tr>
          <tr><td style="padding:8px;background:#e0e7ff;font-weight:bold">Paid</td><td style="padding:8px;color:green">₵${feeRecord.paid}</td></tr>
          <tr><td style="padding:8px;background:#fee2e2;font-weight:bold">Outstanding</td><td style="padding:8px;color:red;font-weight:bold">₵${balance}</td></tr>
        </table>
        <p>Please visit the school to make payment at your earliest convenience.</p>
        <p style="color:#64748b;font-size:13px">EduCore School Management System</p>
      </div>
    `,
  });
};

// ─── Attendance Alert ─────────────────────────────────────────────────────────
const sendAttendanceAlert = async (student, status, date) => {
  if (status === 'Present') return;
  await sendEmail({
    to: student.guardian_email || student.email,
    subject: `Attendance Alert — ${student.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
        <h2 style="color:#1d4ed8">📋 EduCore — Attendance Alert</h2>
        <p>Dear <strong>${student.guardian}</strong>,</p>
        <p>Please be informed that <strong>${student.name}</strong> was marked as 
           <strong style="color:${status==='Absent'?'#ef4444':'#f59e0b'}">${status}</strong> 
           on <strong>${date}</strong>.</p>
        ${status === 'Absent' ? '<p>If this is unexpected, please contact the school.</p>' : ''}
        <p style="color:#64748b;font-size:13px">EduCore School Management System</p>
      </div>
    `,
  });
};

// ─── Results Notification ─────────────────────────────────────────────────────
const sendResultsNotification = async (student, examName, score, grade) => {
  await sendEmail({
    to: student.guardian_email || student.email,
    subject: `Exam Results Available — ${examName}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
        <h2 style="color:#1d4ed8">📝 EduCore — Exam Results</h2>
        <p>Dear <strong>${student.guardian}</strong>,</p>
        <p>Results for <strong>${student.name}</strong> are now available:</p>
        <div style="background:#f0f4ff;padding:16px;border-radius:8px;margin:16px 0">
          <p><strong>Exam:</strong> ${examName}</p>
          <p><strong>Score:</strong> ${score}</p>
          <p><strong>Grade:</strong> ${grade}</p>
        </div>
        <p style="color:#64748b;font-size:13px">EduCore School Management System</p>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  createNotification,
  sendFeeReminder,
  sendAttendanceAlert,
  sendResultsNotification,
};
