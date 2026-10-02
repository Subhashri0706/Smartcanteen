const http = require("http");
const pool = require("./db");

async function testBackend() {
  console.log("Starting backend verification tests...");

  // Test 1: Verify PostgreSQL connection
  try {
    const dbRes = await pool.query("SELECT COUNT(*) FROM foods");
    console.log(`✓ PostgreSQL Connected! Foods in DB: ${dbRes.rows[0].count}`);
  } catch (err) {
    console.error("❌ DB Connection test failed:", err.message);
    process.exit(1);
  }

  // Test 2: Verify users exist
  try {
    const usersRes = await pool.query("SELECT email, role FROM users");
    console.log("✓ Seeded Users:", usersRes.rows);
  } catch (err) {
    console.error("❌ Users check failed:", err.message);
    process.exit(1);
  }

  console.log("🎉 All DB checks passed!");
  process.exit(0);
}

testBackend();
