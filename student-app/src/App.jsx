import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function App() {
  // Backend & DB Connection State
  const [dbStatus, setDbStatus] = useState({ connected: false, checking: true, message: "" });

  // User Auth State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("canteen_student_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({
    name: "Rahul Sharma",
    email: "student@canteen.com",
    password: "student123",
    phone: "9876543211",
    rollNumber: "CS202401",
  });
  const [authError, setAuthError] = useState("");

  // Menu State
  const [foods, setFoods] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  // Cart & Pre-booking State
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState("Dine-in"); // 'Dine-in' or 'Parcel'
  const [mealSlot, setMealSlot] = useState("Lunch");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [showCartModal, setShowCartModal] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Confirmed Booking Modal State
  const [recentBooking, setRecentBooking] = useState(null);

  // My Bookings / History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 1. Verify Backend and Database Connection on Mount
  useEffect(() => {
    checkConnection();
    fetchFoods();
  }, []);

  const checkConnection = async () => {
    try {
      setDbStatus({ connected: false, checking: true, message: "Connecting to backend..." });
      const res = await fetch(`${API_BASE}/api/test-db`);
      const data = await res.json();
      if (data.success) {
        setDbStatus({
          connected: true,
          checking: false,
          message: `Connected to PostgreSQL (${data.database})`,
        });
      } else {
        setDbStatus({
          connected: false,
          checking: false,
          message: data.message || "Database connection failed",
        });
      }
    } catch (err) {
      setDbStatus({
        connected: false,
        checking: false,
        message: "Backend server offline (Check port 5000)",
      });
    }
  };

  // 2. Fetch Food Menu
  const fetchFoods = async () => {
    try {
      setLoadingFoods(true);
      const res = await fetch(`${API_BASE}/api/foods/today`);
      const data = await res.json();
      if (data.success) {
        setFoods(data.foods);
      }
    } catch (err) {
      console.error("Error fetching foods:", err);
    } finally {
      setLoadingFoods(false);
    }
  };

  // 3. User Login / Registration Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        localStorage.setItem("canteen_student_user", JSON.stringify(data.user));
        setShowAuthModal(false);
      } else {
        setAuthError(data.message || "Authentication failed");
      }
    } catch (err) {
      setAuthError("Failed to reach server.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("canteen_student_user");
  };

  // 4. Cart Management
  const addToCart = (food) => {
    if (food.available_quantity <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.foodId === food.id);
      if (existing) {
        if (existing.quantity >= food.available_quantity) {
          alert(`Maximum available quantity for ${food.name} is ${food.available_quantity}`);
          return prev;
        }
        return prev.map((item) =>
          item.foodId === food.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prev,
          {
            foodId: food.id,
            name: food.name,
            price: parseFloat(food.price),
            quantity: 1,
            maxQty: food.available_quantity,
            allowDineIn: food.allow_dine_in,
            allowParcel: food.allow_parcel,
            mealSlot: food.meal_slot,
          },
        ];
      }
    });
  };

  const updateCartQuantity = (foodId, delta) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.foodId === foodId) {
            const newQty = item.quantity + delta;
            if (newQty > item.maxQty) {
              alert(`Only ${item.maxQty} portions available!`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // 5. Submit Pre-Booking
  const handlePreBook = async () => {
    if (cart.length === 0) {
      alert("Please add items to cart.");
      return;
    }

    // Ensure student is identified
    const studentName = user ? user.name : "Guest Student";
    const studentEmail = user ? user.email : "student@canteen.com";
    const studentId = user ? user.id : null;

    setBookingLoading(true);
    try {
      const payload = {
        userId: studentId,
        userName: studentName,
        userEmail: studentEmail,
        mealSlot: cart[0]?.mealSlot || mealSlot,
        orderType: orderType,
        paymentMethod: paymentMethod,
        items: cart.map((item) => ({
          foodId: item.foodId,
          quantity: item.quantity,
        })),
      };

      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setRecentBooking(data.booking);
        setCart([]);
        setShowCartModal(false);
        fetchFoods(); // refresh food quantity stock
      } else {
        alert(data.message || "Pre-booking failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error placing booking. Check if backend is running.");
    } finally {
      setBookingLoading(false);
    }
  };

  // 6. Fetch Booking History
  const fetchBookingHistory = async () => {
    try {
      setLoadingHistory(true);
      setShowHistoryModal(true);
      const url = user ? `${API_BASE}/api/bookings?userId=${user.id}` : `${API_BASE}/api/bookings`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMyBookings(data.bookings);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 7. Cancel Booking
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, reason: "Cancelled by student" }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Booking cancelled successfully! Food quantity has been restored.");
        fetchBookingHistory();
        fetchFoods();
      } else {
        alert(data.message || "Failed to cancel booking.");
      }
    } catch (err) {
      alert("Error cancelling booking.");
    }
  };

  // Filter foods by category
  const filteredFoods = activeCategory === "All"
    ? foods
    : foods.filter((f) => f.category.toLowerCase() === activeCategory.toLowerCase());

  return (
    <div>
      {/* 1. Header Navbar */}
      <header className="navbar">
        <div className="nav-container">
          <div className="brand">
            <span className="brand-icon">🍛</span>
            <span>Smart Canteen</span>
          </div>

          <div className="nav-actions">
            {/* Database & Backend Status */}
            <div
              className={`status-badge ${dbStatus.connected ? "" : "offline"}`}
              title="PostgreSQL Database Connection Status"
            >
              <span className="status-dot"></span>
              <span>{dbStatus.message}</span>
            </div>

            {/* My Bookings */}
            <button className="btn btn-outline btn-sm" onClick={fetchBookingHistory}>
              📋 My Bookings
            </button>

            {/* Cart Button */}
            <button className="btn btn-primary btn-sm" onClick={() => setShowCartModal(true)}>
              🛒 Cart ({cartItemCount})
            </button>

            {/* User Profile / Login */}
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>👤 {user.name}</span>
                <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={() => setShowAuthModal(true)}>
                🔑 Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div>
              <h1 className="hero-title">Campus Smart Pre-Booking</h1>
              <p className="hero-subtitle">
                Pre-book your breakfast, lunch, and evening snacks in advance. Save time, skip the queues, and help our kitchen eliminate food waste.
              </p>
            </div>
            <div className="hero-stats">
              <div className="hero-stat-card">
                <div className="hero-stat-number">{foods.length}</div>
                <div className="hero-stat-label">Today's Dishes</div>
              </div>
              <div className="hero-stat-card">
                <div className="hero-stat-number">⚡ Fast</div>
                <div className="hero-stat-label">Zero Queue Pickup</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Menu Area */}
      <main className="container">
        {/* Category Tabs */}
        <div className="filter-container">
          {["All", "Breakfast", "Lunch", "Evening Snacks"].map((cat) => (
            <button
              key={cat}
              className={`filter-tab ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === "Breakfast" && "🌅 "}
              {cat === "Lunch" && "🍛 "}
              {cat === "Evening Snacks" && "☕ "}
              {cat === "All" && "✨ "}
              {cat}
            </button>
          ))}
        </div>

        {/* Food Items Grid */}
        {loadingFoods ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <p>Loading fresh canteen menu from database...</p>
          </div>
        ) : filteredFoods.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍽️</div>
            <p>No food items found in this category for today.</p>
          </div>
        ) : (
          <div className="menu-grid">
            {filteredFoods.map((food) => {
              const cartItem = cart.find((i) => i.foodId === food.id);
              const isSoldOut = food.available_quantity <= 0;

              return (
                <div key={food.id} className="food-card">
                  <div className="food-img-container">
                    <img src={food.image_url} alt={food.name} className="food-img" />
                    <span className="category-tag">{food.category}</span>
                    {isSoldOut && <span className="sold-out-badge">SOLD OUT</span>}
                  </div>

                  <div className="food-body">
                    <h3 className="food-title">{food.name}</h3>
                    <p className="food-desc">{food.description}</p>

                    <div className="food-meta">
                      <div className="order-modes">
                        {food.allow_dine_in && <span className="mode-tag">🍽️ Dine-in</span>}
                        {food.allow_parcel && <span className="mode-tag">📦 Parcel</span>}
                      </div>
                      <span className="deadline-tag">⏰ Book by {food.booking_deadline}</span>
                    </div>

                    <div className="food-footer">
                      <div>
                        <div className="food-price">₹{parseFloat(food.price).toFixed(2)}</div>
                        <div style={{ fontSize: "0.8rem", color: isSoldOut ? "var(--danger)" : "var(--text-muted)" }}>
                          {isSoldOut ? "0 left" : `${food.available_quantity} portions left`}
                        </div>
                      </div>

                      {isSoldOut ? (
                        <button className="btn btn-outline btn-sm" disabled>
                          Sold Out
                        </button>
                      ) : cartItem ? (
                        <div className="quantity-control">
                          <button className="qty-btn" onClick={() => updateCartQuantity(food.id, -1)}>
                            -
                          </button>
                          <span className="qty-val">{cartItem.quantity}</span>
                          <button className="qty-btn" onClick={() => updateCartQuantity(food.id, 1)}>
                            +
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => addToCart(food)}>
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. CART & PRE-BOOKING MODAL */}
      {showCartModal && (
        <div className="modal-overlay" onClick={() => setShowCartModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">🛒 Pre-Book Your Meal</h2>
              <button className="close-btn" onClick={() => setShowCartModal(false)}>
                &times;
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <p>Your pre-booking cart is empty.</p>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div key={item.foodId} className="cart-item">
                      <div>
                        <div className="cart-item-name">{item.name}</div>
                        <div className="cart-item-meta">₹{item.price} each</div>
                      </div>
                      <div className="quantity-control">
                        <button className="qty-btn" onClick={() => updateCartQuantity(item.foodId, -1)}>
                          -
                        </button>
                        <span className="qty-val">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateCartQuantity(item.foodId, 1)}>
                          +
                        </button>
                        <span style={{ fontWeight: 700, marginLeft: "0.75rem", minWidth: "60px", textAlign: "right" }}>
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="summary-row total">
                    <span>Total Payable</span>
                    <span>₹{cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Dining Preference */}
                <div className="form-group">
                  <label className="form-label">Dining Preference</label>
                  <div className="radio-group">
                    <div
                      className={`radio-card ${orderType === "Dine-in" ? "active" : ""}`}
                      onClick={() => setOrderType("Dine-in")}
                    >
                      🍽️ Dine-in
                    </div>
                    <div
                      className={`radio-card ${orderType === "Parcel" ? "active" : ""}`}
                      onClick={() => setOrderType("Parcel")}
                    >
                      📦 Parcel / Takeaway
                    </div>
                  </div>
                </div>

                {/* Meal Slot */}
                <div className="form-group">
                  <label className="form-label">Meal Slot</label>
                  <select
                    className="form-select"
                    value={mealSlot}
                    onChange={(e) => setMealSlot(e.target.value)}
                  >
                    <option value="Breakfast">🌅 Breakfast</option>
                    <option value="Lunch">🍛 Lunch</option>
                    <option value="Evening Snacks">☕ Evening Snacks</option>
                  </select>
                </div>

                {/* Payment Option */}
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="UPI">📱 Instant UPI (Google Pay / PhonePe)</option>
                    <option value="Card">💳 Debit / Credit Card</option>
                    <option value="Counter">💵 Cash on Pickup</option>
                  </select>
                </div>

                {/* User Info Prompt */}
                {!user && (
                  <div style={{ background: "#fef3c7", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.85rem", color: "#92400e" }}>
                    💡 Tip: Log in to save bookings to your student profile!
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "0.85rem", fontSize: "1.05rem" }}
                  onClick={handlePreBook}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? "Processing Booking..." : `Confirm & Pay ₹${cartTotal.toFixed(2)}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. BOOKING SUCCESS & QR TOKEN MODAL */}
      {recentBooking && (
        <div className="modal-overlay" onClick={() => setRecentBooking(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">🎉 Pre-Booking Confirmed!</h2>
              <button className="close-btn" onClick={() => setRecentBooking(null)}>
                &times;
              </button>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Booking Reference ID</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "1px" }}>
                {recentBooking.booking_number}
              </div>

              {/* QR Verification Box */}
              <div className="qr-container">
                <div className="qr-box">
                  <div style={{ fontSize: "3rem" }}>📱</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--dark)" }}>
                    Digital Food Token
                  </div>
                  <div className="qr-token">{recentBooking.qr_token}</div>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
                  Show this token or booking number at the canteen pickup counter.
                </p>
              </div>

              {/* Order Details */}
              <div className="cart-summary" style={{ textAlign: "left" }}>
                <div className="summary-row">
                  <span>Order Type</span>
                  <span style={{ fontWeight: 600 }}>{recentBooking.order_type}</span>
                </div>
                <div className="summary-row">
                  <span>Meal Slot</span>
                  <span style={{ fontWeight: 600 }}>{recentBooking.meal_slot}</span>
                </div>
                <div className="summary-row">
                  <span>Payment Status</span>
                  <span className="badge badge-success">{recentBooking.payment_status}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Paid</span>
                  <span>₹{parseFloat(recentBooking.total_amount).toFixed(2)}</span>
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setRecentBooking(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MY BOOKINGS / HISTORY MODAL */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">📋 My Canteen Bookings</h2>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>
                &times;
              </button>
            </div>

            {loadingHistory ? (
              <div className="empty-state">
                <p>Loading bookings...</p>
              </div>
            ) : myBookings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>No previous bookings found.</p>
              </div>
            ) : (
              <div className="bookings-list">
                {myBookings.map((b) => (
                  <div key={b.id} className="booking-card">
                    <div className="booking-header">
                      <span className="booking-id">{b.booking_number}</span>
                      <span className={`badge ${b.status === "Confirmed" ? "badge-success" : "badge-danger"}`}>
                        {b.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                      📅 {new Date(b.booking_date).toLocaleDateString()} | {b.meal_slot} | {b.order_type}
                    </div>

                    <div style={{ background: "#f8fafc", padding: "0.5rem 0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
                      {b.items && b.items.length > 0 ? (
                        b.items.map((it, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{it.quantity}x {it.foodName}</span>
                            <span>₹{parseFloat(it.subtotal).toFixed(2)}</span>
                          </div>
                        ))
                      ) : (
                        <div>Pre-booked Meal Items</div>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Token: </span>
                        <code style={{ fontSize: "0.8rem" }}>{b.qr_token}</code>
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--primary)" }}>
                        ₹{parseFloat(b.total_amount).toFixed(2)}
                      </div>
                    </div>

                    {b.status === "Confirmed" && (
                      <div style={{ marginTop: "0.75rem", textAlign: "right" }}>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                          onClick={() => handleCancelBooking(b.id)}
                        >
                          Cancel Booking
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. AUTH MODAL (Login / Register) */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{authMode === "login" ? "Student Login" : "Student Registration"}</h2>
              <button className="close-btn" onClick={() => setShowAuthModal(false)}>
                &times;
              </button>
            </div>

            {authError && (
              <div style={{ background: "#fee2e2", color: "#dc2626", padding: "0.65rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem" }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Roll Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={authForm.rollNumber}
                      onChange={(e) => setAuthForm({ ...authForm, rollNumber: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }}>
                {authMode === "login" ? "Sign In" : "Register"}
              </button>
            </form>

            <div style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.85rem" }}>
              {authMode === "login" ? (
                <span>
                  Don't have an account?{" "}
                  <button
                    style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer" }}
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                  >
                    Register here
                  </button>
                </span>
              ) : (
                <span>
                  Already registered?{" "}
                  <button
                    style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer" }}
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                  >
                    Login here
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
