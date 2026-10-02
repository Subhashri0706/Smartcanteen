require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

// Allowed origins for CORS (Production Frontends & Local Development)
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.STUDENT_APP_URL,
  process.env.ADMIN_APP_URL,
  process.env.FRONTEND_URL,
].filter(Boolean);

// CORS Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, Postman)
      if (!origin) return callback(null, true);

      // In development or if origin is in allowedOrigins or wildcard
      if (
        process.env.NODE_ENV !== "production" ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());

// ==========================================
// 1. HEALTH & DATABASE STATUS CHECK
// ==========================================
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Smart Canteen Backend is running!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as current_time, current_database() as db_name");
    res.json({
      success: true,
      message: "Database connected successfully!",
      database: result.rows[0].db_name,
      time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("DB Test Error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// ==========================================
// 2. AUTHENTICATION (Student & Admin)
// ==========================================

// Login (Student & Admin)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const result = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    // Return user info without exposing password
    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        rollNumber: user.roll_number,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
});

// Student Registration
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone, rollNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }

    // Check if email already exists
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Email is already registered. Please log in." });
    }

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, phone, roll_number)
       VALUES ($1, $2, $3, 'student', $4, $5)
       RETURNING id, name, email, role, phone, roll_number`,
      [name.trim(), email.trim().toLowerCase(), password, phone || null, rollNumber || null]
    );

    const newUser = result.rows[0];
    res.status(201).json({
      success: true,
      message: "Registration successful! You can now log in.",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        rollNumber: newUser.roll_number,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
});

// ==========================================
// 3. FOODS / MENU MANAGEMENT
// ==========================================

// Get all food items (supports optional filters: ?category=Lunch&date=2026-10-02)
app.get("/api/foods", async (req, res) => {
  try {
    const { category, mealSlot, date } = req.query;
    let query = "SELECT * FROM foods WHERE is_active = true";
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    } else if (mealSlot) {
      params.push(mealSlot);
      query += ` AND meal_slot = $${params.length}`;
    }

    if (date) {
      params.push(date);
      query += ` AND date = $${params.length}`;
    }

    query += " ORDER BY id ASC";

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, foods: result.rows });
  } catch (error) {
    console.error("Get Foods Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch food items." });
  }
});

// Get today's foods
app.get("/api/foods/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    // Fetch today's items or fallback to all active items
    const result = await pool.query(
      "SELECT * FROM foods WHERE is_active = true AND (date = $1 OR date IS NULL) ORDER BY category, id ASC",
      [today]
    );

    // If no items specific to today, return active items
    if (result.rows.length === 0) {
      const allActive = await pool.query("SELECT * FROM foods WHERE is_active = true ORDER BY category, id ASC");
      return res.json({ success: true, count: allActive.rows.length, foods: allActive.rows });
    }

    res.json({ success: true, count: result.rows.length, foods: result.rows });
  } catch (error) {
    console.error("Get Today Foods Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch today's foods." });
  }
});

// Add Food Item (Admin)
app.post("/api/foods", async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      available_quantity,
      date,
      meal_slot,
      booking_deadline,
      allow_dine_in,
      allow_parcel,
      image_url,
    } = req.body;

    if (!name || price === undefined || available_quantity === undefined) {
      return res.status(400).json({ success: false, message: "Name, price, and available quantity are required." });
    }

    const foodDate = date || new Date().toISOString().split("T")[0];
    const cat = category || meal_slot || "Lunch";
    const slot = meal_slot || category || "Lunch";
    const deadline = booking_deadline || "12:30";

    const result = await pool.query(
      `INSERT INTO foods 
       (name, description, category, price, available_quantity, date, meal_slot, booking_deadline, allow_dine_in, allow_parcel, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        name.trim(),
        description || "",
        cat,
        parseFloat(price),
        parseInt(available_quantity, 10),
        foodDate,
        slot,
        deadline,
        allow_dine_in !== undefined ? Boolean(allow_dine_in) : true,
        allow_parcel !== undefined ? Boolean(allow_parcel) : true,
        image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60",
      ]
    );

    res.status(201).json({ success: true, message: "Food item added successfully!", food: result.rows[0] });
  } catch (error) {
    console.error("Add Food Error:", error);
    res.status(500).json({ success: false, message: "Failed to add food item." });
  }
});

// Edit Food Item (Admin)
app.put("/api/foods/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      price,
      available_quantity,
      date,
      meal_slot,
      booking_deadline,
      allow_dine_in,
      allow_parcel,
      image_url,
      is_active,
    } = req.body;

    const result = await pool.query(
      `UPDATE foods 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           price = COALESCE($4, price),
           available_quantity = COALESCE($5, available_quantity),
           date = COALESCE($6, date),
           meal_slot = COALESCE($7, meal_slot),
           booking_deadline = COALESCE($8, booking_deadline),
           allow_dine_in = COALESCE($9, allow_dine_in),
           allow_parcel = COALESCE($10, allow_parcel),
           image_url = COALESCE($11, image_url),
           is_active = COALESCE($12, is_active)
       WHERE id = $13
       RETURNING *`,
      [
        name,
        description,
        category,
        price !== undefined ? parseFloat(price) : null,
        available_quantity !== undefined ? parseInt(available_quantity, 10) : null,
        date,
        meal_slot,
        booking_deadline,
        allow_dine_in,
        allow_parcel,
        image_url,
        is_active,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Food item not found." });
    }

    res.json({ success: true, message: "Food item updated successfully!", food: result.rows[0] });
  } catch (error) {
    console.error("Edit Food Error:", error);
    res.status(500).json({ success: false, message: "Failed to update food item." });
  }
});

// Delete Food Item (Admin)
app.delete("/api/foods/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM foods WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Food item not found." });
    }

    res.json({ success: true, message: "Food item deleted successfully!" });
  } catch (error) {
    console.error("Delete Food Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete food item." });
  }
});

// ==========================================
// 4. BOOKINGS & PRE-BOOKING SYSTEM
// ==========================================

// Create a new Booking (Pre-book food)
app.post("/api/bookings", async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, userName, userEmail, mealSlot, orderType, items, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty. Please select food items." });
    }

    if (!orderType || !["Dine-in", "Parcel"].includes(orderType)) {
      return res.status(400).json({ success: false, message: "Order type must be 'Dine-in' or 'Parcel'." });
    }

    await client.query("BEGIN");

    // 1. Verify availability of every item and calculate total
    let calculatedTotal = 0;
    const itemsToInsert = [];

    for (const item of items) {
      const foodRes = await client.query("SELECT * FROM foods WHERE id = $1 FOR UPDATE", [item.foodId]);
      if (foodRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: `Item ID ${item.foodId} not found.` });
      }

      const food = foodRes.rows[0];

      // Check order type availability
      if (orderType === "Dine-in" && !food.allow_dine_in) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: `${food.name} is not available for Dine-in.` });
      }
      if (orderType === "Parcel" && !food.allow_parcel) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: `${food.name} is not available for Parcel.` });
      }

      // Check available quantity
      const requestedQty = parseInt(item.quantity, 10) || 1;
      if (food.available_quantity < requestedQty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${food.name}. Available: ${food.available_quantity}, Requested: ${requestedQty}`,
        });
      }

      // Deduct quantity
      await client.query("UPDATE foods SET available_quantity = available_quantity - $1 WHERE id = $2", [
        requestedQty,
        food.id,
      ]);

      const subtotal = parseFloat(food.price) * requestedQty;
      calculatedTotal += subtotal;

      itemsToInsert.push({
        foodId: food.id,
        foodName: food.name,
        price: parseFloat(food.price),
        quantity: requestedQty,
        subtotal: subtotal,
      });
    }

    // 2. Generate unique booking number & QR verification token
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingNumber = `SC-${Date.now().toString().slice(-4)}${uniqueSuffix}`;
    const qrToken = `QR-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const bookingDate = new Date().toISOString().split("T")[0];
    const slot = mealSlot || "General";

    // 3. Insert into bookings table
    const bookingRes = await client.query(
      `INSERT INTO bookings 
       (booking_number, user_id, user_name, user_email, meal_slot, booking_date, order_type, total_amount, payment_status, payment_method, status, qr_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Paid', $9, 'Confirmed', $10)
       RETURNING *`,
      [
        bookingNumber,
        userId || null,
        userName || "Student",
        userEmail || "",
        slot,
        bookingDate,
        orderType,
        calculatedTotal,
        paymentMethod || "UPI",
        qrToken,
      ]
    );

    const booking = bookingRes.rows[0];

    // 4. Insert booking items
    for (const item of itemsToInsert) {
      await client.query(
        `INSERT INTO booking_items (booking_id, food_id, food_name, price, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [booking.id, item.foodId, item.foodName, item.price, item.quantity, item.subtotal]
      );
    }

    // 5. Insert payment record
    const transactionId = `TXN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    await client.query(
      `INSERT INTO payments (booking_id, amount, payment_method, transaction_id, status)
       VALUES ($1, $2, $3, $4, 'Success')`,
      [booking.id, calculatedTotal, paymentMethod || "UPI", transactionId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Pre-booking confirmed successfully!",
      booking: {
        ...booking,
        items: itemsToInsert,
        transactionId: transactionId,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Booking Error:", error);
    res.status(500).json({ success: false, message: "Booking failed. Please try again." });
  } finally {
    client.release();
  }
});

// Get Bookings (Admin views all; Student views theirs by ?userId=X)
app.get("/api/bookings", async (req, res) => {
  try {
    const { userId, status, date } = req.query;
    let query = `
      SELECT b.*, 
             COALESCE(json_agg(
               json_build_object(
                 'id', bi.id,
                 'foodId', bi.food_id,
                 'foodName', bi.food_name,
                 'price', bi.price,
                 'quantity', bi.quantity,
                 'subtotal', bi.subtotal
               )
             ) FILTER (WHERE bi.id IS NOT NULL), '[]') AS items
      FROM bookings b
      LEFT JOIN booking_items bi ON b.id = bi.booking_id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      params.push(userId);
      query += ` AND b.user_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }

    if (date) {
      params.push(date);
      query += ` AND b.booking_date = $${params.length}`;
    }

    query += " GROUP BY b.id ORDER BY b.created_at DESC";

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, bookings: result.rows });
  } catch (error) {
    console.error("Get Bookings Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bookings." });
  }
});

// Get single booking details
app.get("/api/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const bookingRes = await pool.query("SELECT * FROM bookings WHERE id = $1 OR booking_number = $1", [id]);

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    const booking = bookingRes.rows[0];
    const itemsRes = await pool.query("SELECT * FROM booking_items WHERE booking_id = $1", [booking.id]);
    const paymentsRes = await pool.query("SELECT * FROM payments WHERE booking_id = $1", [booking.id]);

    res.json({
      success: true,
      booking: {
        ...booking,
        items: itemsRes.rows,
        payment: paymentsRes.rows[0] || null,
      },
    });
  } catch (error) {
    console.error("Get Booking By ID Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch booking details." });
  }
});

// Cancel a Booking (Restores available quantity back to menu)
app.post("/api/bookings/:id/cancel", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason, userId } = req.body;

    await client.query("BEGIN");

    const bookingRes = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [id]);
    if (bookingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    const booking = bookingRes.rows[0];
    if (booking.status === "Cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Booking is already cancelled." });
    }

    // 1. Fetch booking items to restore inventory
    const itemsRes = await client.query("SELECT * FROM booking_items WHERE booking_id = $1", [booking.id]);
    for (const item of itemsRes.rows) {
      if (item.food_id) {
        await client.query("UPDATE foods SET available_quantity = available_quantity + $1 WHERE id = $2", [
          item.quantity,
          item.food_id,
        ]);
      }
    }

    // 2. Update booking status
    await client.query(
      "UPDATE bookings SET status = 'Cancelled', payment_status = 'Refunded' WHERE id = $1",
      [booking.id]
    );

    // 3. Record in cancellations table
    await client.query(
      "INSERT INTO cancellations (booking_id, reason, cancelled_by) VALUES ($1, $2, $3)",
      [booking.id, reason || "Cancelled by student", userId || booking.user_id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Booking cancelled successfully. Quantity restored.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cancel Booking Error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel booking." });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. ADMIN ANALYTICS & PREPARATION SUMMARY
// ==========================================

// Get Preparation Count / Quantity Summary for Kitchen Prep
app.get("/api/admin/prep-summary", async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    const prepQuery = `
      SELECT 
        bi.food_name,
        b.meal_slot,
        b.order_type,
        SUM(bi.quantity) as total_quantity,
        COUNT(DISTINCT b.id) as total_orders
      FROM booking_items bi
      JOIN bookings b ON bi.booking_id = b.id
      WHERE b.status = 'Confirmed' AND b.booking_date = $1
      GROUP BY bi.food_name, b.meal_slot, b.order_type
      ORDER BY b.meal_slot, bi.food_name
    `;

    const result = await pool.query(prepQuery, [targetDate]);
    res.json({ success: true, date: targetDate, summary: result.rows });
  } catch (error) {
    console.error("Prep Summary Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch preparation summary." });
  }
});

// Admin Dashboard Overall Stats
app.get("/api/admin/stats", async (req, res) => {
  try {
    const totalOrdersRes = await pool.query("SELECT COUNT(*) FROM bookings");
    const confirmedOrdersRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE status = 'Confirmed'");
    const cancelledOrdersRes = await pool.query("SELECT COUNT(*) FROM bookings WHERE status = 'Cancelled'");
    const revenueRes = await pool.query("SELECT COALESCE(SUM(total_amount), 0) as total_revenue FROM bookings WHERE status = 'Confirmed'");
    const activeFoodsRes = await pool.query("SELECT COUNT(*) FROM foods WHERE is_active = true");

    res.json({
      success: true,
      stats: {
        totalOrders: parseInt(totalOrdersRes.rows[0].count),
        confirmedOrders: parseInt(confirmedOrdersRes.rows[0].count),
        cancelledOrders: parseInt(cancelledOrdersRes.rows[0].count),
        totalRevenue: parseFloat(revenueRes.rows[0].total_revenue),
        activeMenuItems: parseInt(activeFoodsRes.rows[0].count),
      },
    });
  } catch (error) {
    console.error("Admin Stats Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch dashboard stats." });
  }
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Smart Canteen Backend running on http://localhost:${PORT}`);
});