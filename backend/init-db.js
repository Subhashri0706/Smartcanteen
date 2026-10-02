const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function initializeDatabase() {
  console.log("Connecting to PostgreSQL database...");
  
  try {
    // 1. Read and run schema.sql
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    
    await pool.query(schemaSql);
    console.log("✓ Database tables created/verified successfully.");

    // 2. Seed Default Admin & Student Users if not exists
    const usersCount = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(usersCount.rows[0].count) === 0) {
      await pool.query(
        `INSERT INTO users (name, email, password, role, phone, roll_number) VALUES
         ('Admin Manager', 'admin@canteen.com', 'admin123', 'admin', '9876543210', 'ADM001'),
         ('Rahul Sharma', 'student@canteen.com', 'student123', 'student', '9876543211', 'CS202401')`
      );
      console.log("✓ Default admin and student users inserted.");
    }

    // 3. Seed Sample Food Menu for Today if empty
    const foodsCount = await pool.query("SELECT COUNT(*) FROM foods");
    if (parseInt(foodsCount.rows[0].count) === 0) {
      const today = new Date().toISOString().split("T")[0];
      await pool.query(
        `INSERT INTO foods (name, description, category, price, available_quantity, date, meal_slot, booking_deadline, allow_dine_in, allow_parcel, image_url) VALUES
         ('Masala Dosa with Sambar', 'Crispy fermented crepe served with aromatic lentil sambar and coconut chutney', 'Breakfast', 50.00, 30, $1, 'Breakfast', '09:30', true, true, 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500&auto=format&fit=crop&q=60'),
         ('Idli Vada Combo', '2 soft steamed idlis and 1 crispy medu vada with chutney and sambar', 'Breakfast', 40.00, 25, $1, 'Breakfast', '09:30', true, true, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60'),
         ('Poha & Chai', 'Light spiced flattened rice with roasted peanuts and hot masala chai', 'Breakfast', 30.00, 20, $1, 'Breakfast', '09:30', true, true, 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=60'),
         ('Special Veg Thali', 'Paneer curry, dal tadka, 3 rotis, jeera rice, salad and gulab jamun', 'Lunch', 90.00, 40, $1, 'Lunch', '12:30', true, true, 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500&auto=format&fit=crop&q=60'),
         ('Chicken Biryani Bowl', 'Fragrant basmati rice slow-cooked with spiced marinated chicken and raita', 'Lunch', 130.00, 35, $1, 'Lunch', '12:30', true, true, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=60'),
         ('Paneer Butter Masala & Parotta', 'Creamy butter gravy paneer served with 2 layered flaky malabar parottas', 'Lunch', 100.00, 25, $1, 'Lunch', '12:30', true, true, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=60'),
         ('Samosa Chaat (2 pcs)', 'Crispy crushed samosas topped with chickpeas, sweet tamarind & mint chutney', 'Evening Snacks', 35.00, 40, $1, 'Evening Snacks', '17:00', true, true, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=60'),
         ('Veg Cheese Grilled Sandwich', 'Toasted triple layer sandwich loaded with fresh veggies and melted cheese', 'Evening Snacks', 55.00, 30, $1, 'Evening Snacks', '17:00', true, true, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=60'),
         ('Cold Coffee & Brownie', 'Thick creamy chilled coffee paired with rich chocolate fudge brownie', 'Evening Snacks', 60.00, 20, $1, 'Evening Snacks', '17:00', true, true, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=60')`,
        [today]
      );
      console.log("✓ Sample menu items seeded for today.");
    }

    console.log("🎉 Database initialization completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    process.exit(1);
  }
}

initializeDatabase();
