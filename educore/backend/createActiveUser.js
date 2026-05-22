require("dotenv").config();
const bcrypt = require("bcryptjs");
const { query } = require("./db/pool");
// createAdmin.js: const pool = require("./config/db");

async function createAdmin() {
    try {
        const password = "Xiple@2020";
        const hashedPassword = await bcrypt.hash(password, 10);
        const email = "teiezekiel131@gmail.com";
        const role = "Admin";
        const name = "Tei Ezekiel"; // Derived from email
        const avatar = "TE";

        const result = await query(
            `INSERT INTO users (name, email, password, role, avatar)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (email) DO UPDATE SET password = $3, role = $4, avatar = $5
             RETURNING id, name, email, role`,
            [name, email, hashedPassword, role, avatar]
        );

        if (result.rows.length > 0) {
            console.log("Admin created/updated:", result.rows[0]);
        }
    } catch (error) {
        console.error(error);
    }
    process.exit();
}

createAdmin();
