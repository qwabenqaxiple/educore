require('dotenv').config();
const { pool } = require('./db/pool.js');

async function getSubjects() {
  try {
    const res = await pool.query("SELECT * FROM subjects");
    console.log(res.rows);
  } finally {
    pool.end();
  }
}

getSubjects();
