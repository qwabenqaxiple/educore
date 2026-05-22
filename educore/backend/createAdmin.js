const bcrypt = require("bcryptjs");
const pool = require("./config/db");

async function createAdmin() {

    try {

        const password = "admin123";
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, role`,
            ["System Admin", "admin@educore.com", hashedPassword, "Admin"]
        );

        if (result.rows.length > 0) {
            console.log("Admin created:", result.rows[0]);
        } else {
            console.log("Admin already exists");
        }

    } catch (error) {
        console.error(error);
    }

    process.exit();
}

createAdmin();