require('./loadEnv');
const { pool } = require('./db/pool.js');

async function removeData() {
  try {
    const query = `
      DELETE FROM subjects 
      WHERE code = 'ICT' OR name = 'ICT'
      RETURNING *;
    `;
    
    console.log("Running remove query for ICT...");
    const res = await pool.query(query);
    console.log(`Deleted ${res.rowCount} subjects.`);
    console.log('Deleted subjects:', res.rows.map(r => r.name));
  } catch (err) {
    console.error("Error during deletion:", err);
  } finally {
    pool.end();
  }
}

removeData();
