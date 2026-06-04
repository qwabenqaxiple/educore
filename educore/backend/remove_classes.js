require('./loadEnv');
const { pool } = require('./db/pool.js');

async function removeClasses() {
  try {
    const classNames = ['Form 1A', 'Form 1B', 'Form 2A', 'Form 2B', 'Form 3A', 'Form 3B', 'FORM 1A', 'FORM 1B', 'FORM 2A', 'FORM 2B', 'FORM 3A', 'FORM 3B'];
    
    // Using ILIKE for case-insensitive matching if needed, or exact matching with IN
    const query = `
      DELETE FROM classes 
      WHERE name IN ('Form 1A', 'Form 1B', 'Form 2A', 'Form 2B', 'Form 3A', 'Form 3B', 'FORM 1A', 'FORM 1B', 'FORM 2A', 'FORM 2B', 'FORM 3A', 'FORM 3B')
      RETURNING *;
    `;
    
    console.log("Running remove query...");
    const res = await pool.query(query);
    console.log(`Deleted ${res.rowCount} classes.`);
    console.log('Deleted classes:', res.rows.map(r => r.name));
  } catch (err) {
    console.error("Error during deletion:", err);
  } finally {
    pool.end();
  }
}

removeClasses();
