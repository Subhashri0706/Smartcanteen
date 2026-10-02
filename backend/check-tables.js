const pool = require("./db");

async function check() {
  try {
    const res = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log("Existing tables in database:", res.rows.map(r => r.table_name));
    process.exit(0);
  } catch (err) {
    console.error("Database error:", err.message);
    process.exit(1);
  }
}

check();
