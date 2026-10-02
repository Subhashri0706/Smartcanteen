-- Schema for Smart Canteen Database

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'student', -- 'student' or 'admin'
    phone VARCHAR(20),
    roll_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Foods / Menu Table
CREATE TABLE IF NOT EXISTS foods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'Breakfast', 'Lunch', 'Evening Snacks'
    price NUMERIC(10, 2) NOT NULL,
    available_quantity INT NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_slot VARCHAR(50) NOT NULL, -- 'Breakfast', 'Lunch', 'Evening Snacks'
    booking_deadline VARCHAR(20) NOT NULL DEFAULT '10:30', -- Format HH:MM (24-hour)
    allow_dine_in BOOLEAN DEFAULT TRUE,
    allow_parcel BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    booking_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(100),
    user_email VARCHAR(150),
    meal_slot VARCHAR(50) NOT NULL,
    booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    order_type VARCHAR(20) NOT NULL, -- 'Dine-in' or 'Parcel'
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'Paid', -- 'Paid', 'Pending', 'Failed', 'Refunded'
    payment_method VARCHAR(50) DEFAULT 'UPI',
    status VARCHAR(30) DEFAULT 'Confirmed', -- 'Confirmed', 'Completed', 'Cancelled'
    qr_token VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Booking Items Table
CREATE TABLE IF NOT EXISTS booking_items (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    food_id INT REFERENCES foods(id) ON DELETE SET NULL,
    food_name VARCHAR(150) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- 5. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'UPI',
    transaction_id VARCHAR(100),
    status VARCHAR(30) DEFAULT 'Success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Cancellations Table
CREATE TABLE IF NOT EXISTS cancellations (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    reason TEXT,
    cancelled_by INT REFERENCES users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
