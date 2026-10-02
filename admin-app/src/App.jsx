import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function App() {
  // DB & Backend Status
  const [dbStatus, setDbStatus] = useState({ connected: false, message: "Checking...", database: "" });

  // Admin Auth State
  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem("canteen_admin_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "admin@canteen.com", password: "admin123" });
  const [loginError, setLoginError] = useState("");

  // Navigation Tabs: 'menu', 'prep', 'bookings'
  const [activeTab, setActiveTab] = useState("menu");

  // Dashboard Stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    confirmedOrders: 0,
    cancelledOrders: 0,
    totalRevenue: 0,
    activeMenuItems: 0,
  });

  // Food Menu State
  const [foods, setFoods] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [foodForm, setFoodForm] = useState({
    name: "",
    description: "",
    category: "Lunch",
    price: "",
    available_quantity: 30,
    date: new Date().toISOString().split("T")[0],
    meal_slot: "Lunch",
    booking_deadline: "12:30",
    allow_dine_in: true,
    allow_parcel: true,
    image_url: "",
  });

  // Kitchen Prep State
  const [prepSummary, setPrepSummary] = useState([]);
  const [loadingPrep, setLoadingPrep] = useState(false);

  // Bookings State
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");

  // On Load: Check DB, Load Stats, Load Foods
  useEffect(() => {
    checkConnection();
    fetchStats();
    fetchFoods();
  }, []);

  useEffect(() => {
    if (activeTab === "prep") fetchPrepSummary();
    if (activeTab === "bookings") fetchBookings();
    if (activeTab === "menu") fetchFoods();
    fetchStats();
  }, [activeTab]);

  const checkConnection = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/test-db`);
      const data = await res.json();
      if (data.success) {
        setDbStatus({
          connected: true,
          message: `PostgreSQL Connected (${data.database})`,
          database: data.database,
        });
      } else {
        setDbStatus({ connected: false, message: "Database error", database: "" });
      }
    } catch (err) {
      setDbStatus({ connected: false, message: "Backend offline (port 5000)", database: "" });
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`);
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error("Stats Error:", err);
    }
  };

  const fetchFoods = async () => {
    try {
      setLoadingFoods(true);
      const res = await fetch(`${API_BASE}/api/foods`);
      const data = await res.json();
      if (data.success) setFoods(data.foods);
    } catch (err) {
      console.error("Foods Error:", err);
    } finally {
      setLoadingFoods(false);
    }
  };

  const fetchPrepSummary = async () => {
    try {
      setLoadingPrep(true);
      const res = await fetch(`${API_BASE}/api/admin/prep-summary`);
      const data = await res.json();
      if (data.success) setPrepSummary(data.summary);
    } catch (err) {
      console.error("Prep Summary Error:", err);
    } finally {
      setLoadingPrep(false);
    }
  };

  const fetchBookings = async () => {
    try {
      setLoadingBookings(true);
      const res = await fetch(`${API_BASE}/api/bookings`);
      const data = await res.json();
      if (data.success) setBookings(data.bookings);
    } catch (err) {
      console.error("Bookings Error:", err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Auth Handler
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (data.success && data.user.role === "admin") {
        setAdminUser(data.user);
        localStorage.setItem("canteen_admin_user", JSON.stringify(data.user));
        setShowLoginModal(false);
      } else if (data.success && data.user.role !== "admin") {
        setLoginError("Access denied. Admin privileges required.");
      } else {
        setLoginError(data.message || "Invalid credentials.");
      }
    } catch (err) {
      setLoginError("Could not connect to backend.");
    }
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    localStorage.removeItem("canteen_admin_user");
  };

  // Food Management Actions
  const handleOpenAddFood = () => {
    setEditingFood(null);
    setFoodForm({
      name: "",
      description: "",
      category: "Lunch",
      price: "",
      available_quantity: 30,
      date: new Date().toISOString().split("T")[0],
      meal_slot: "Lunch",
      booking_deadline: "12:30",
      allow_dine_in: true,
      allow_parcel: true,
      image_url: "",
    });
    setShowFoodModal(true);
  };

  const handleOpenEditFood = (food) => {
    setEditingFood(food);
    setFoodForm({
      name: food.name,
      description: food.description || "",
      category: food.category,
      price: food.price,
      available_quantity: food.available_quantity,
      date: food.date ? food.date.split("T")[0] : new Date().toISOString().split("T")[0],
      meal_slot: food.meal_slot,
      booking_deadline: food.booking_deadline,
      allow_dine_in: food.allow_dine_in,
      allow_parcel: food.allow_parcel,
      image_url: food.image_url || "",
    });
    setShowFoodModal(true);
  };

  const handleSaveFood = async (e) => {
    e.preventDefault();
    try {
      const url = editingFood ? `${API_BASE}/api/foods/${editingFood.id}` : `${API_BASE}/api/foods`;
      const method = editingFood ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(foodForm),
      });

      const data = await res.json();
      if (data.success) {
        alert(editingFood ? "Food item updated successfully!" : "Food item added successfully!");
        setShowFoodModal(false);
        fetchFoods();
        fetchStats();
      } else {
        alert(data.message || "Failed to save food item.");
      }
    } catch (err) {
      alert("Error communicating with server.");
    }
  };

  const handleDeleteFood = async (foodId) => {
    if (!window.confirm("Are you sure you want to delete this food item?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/foods/${foodId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("Food item deleted successfully.");
        fetchFoods();
        fetchStats();
      } else {
        alert(data.message || "Failed to delete food item.");
      }
    } catch (err) {
      alert("Error deleting item.");
    }
  };

  const filteredBookings = statusFilter === "All"
    ? bookings
    : bookings.filter((b) => b.status === statusFilter);

  return (
    <div>
      {/* 1. Navbar */}
      <header className="navbar">
        <div className="nav-container">
          <div className="brand">
            <span>🛡️</span>
            <span>Smart Canteen — Admin Portal</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div className={`status-badge ${dbStatus.connected ? "" : "offline"}`}>
              <span className="status-dot"></span>
              <span>{dbStatus.message}</span>
            </div>

            {adminUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>👨‍💼 {adminUser.name}</span>
                <button className="btn btn-outline btn-sm" onClick={handleAdminLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setShowLoginModal(true)}>
                🔑 Admin Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container">
        {/* 2. Quick Dashboard Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div>
              <div className="stat-value">{stats.totalOrders}</div>
              <div className="stat-title">Total Pre-Bookings</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "var(--secondary-light)", color: "var(--secondary)" }}>
              ✅
            </div>
            <div>
              <div className="stat-value">{stats.confirmedOrders}</div>
              <div className="stat-title">Confirmed Orders</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fff7ed", color: "#c2410c" }}>
              🍱
            </div>
            <div>
              <div className="stat-value">{stats.activeMenuItems}</div>
              <div className="stat-title">Active Menu Items</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
              💰
            </div>
            <div>
              <div className="stat-value">₹{stats.totalRevenue.toFixed(2)}</div>
              <div className="stat-title">Confirmed Revenue</div>
            </div>
          </div>
        </div>

        {/* 3. Navigation Tabs */}
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            🍱 Food Menu Management
          </button>
          <button
            className={`tab-btn ${activeTab === "prep" ? "active" : ""}`}
            onClick={() => setActiveTab("prep")}
          >
            👨‍🍳 Kitchen Prep Summary
          </button>
          <button
            className={`tab-btn ${activeTab === "bookings" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings")}
          >
            📋 All Student Bookings
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: MENU MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "menu" && (
          <div>
            <div className="section-header">
              <div>
                <h2 className="section-title">Canteen Food Inventory & Pricing</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Add dishes, update portion quantities, and control Dine-in/Parcel settings.
                </p>
              </div>
              <button className="btn btn-primary" onClick={handleOpenAddFood}>
                + Add New Food Item
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Food Item</th>
                    <th>Category / Slot</th>
                    <th>Price</th>
                    <th>Available Stock</th>
                    <th>Deadline</th>
                    <th>Service Mode</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingFoods ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "2rem" }}>
                        Loading menu from PostgreSQL...
                      </td>
                    </tr>
                  ) : foods.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "2rem" }}>
                        No food items in the database. Click "+ Add New Food Item" above.
                      </td>
                    </tr>
                  ) : (
                    foods.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <img
                              src={f.image_url}
                              alt={f.name}
                              style={{ width: "42px", height: "42px", borderRadius: "6px", objectFit: "cover" }}
                            />
                            <div>
                              <div style={{ fontWeight: 600 }}>{f.name}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {f.description ? f.description.substring(0, 45) + "..." : "No description"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue">{f.category}</span>
                        </td>
                        <td style={{ fontWeight: 700 }}>₹{parseFloat(f.price).toFixed(2)}</td>
                        <td>
                          <span
                            className={`badge ${f.available_quantity > 0 ? "badge-success" : "badge-danger"}`}
                          >
                            {f.available_quantity > 0 ? `${f.available_quantity} available` : "SOLD OUT"}
                          </span>
                        </td>
                        <td>⏰ {f.booking_deadline}</td>
                        <td>
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            {f.allow_dine_in && <span title="Dine-in enabled">🍽️</span>}
                            {f.allow_parcel && <span title="Parcel enabled">📦</span>}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleOpenEditFood(f)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                              onClick={() => handleDeleteFood(f.id)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: KITCHEN PREPARATION SUMMARY */}
        {/* ========================================================================= */}
        {activeTab === "prep" && (
          <div>
            <div className="section-header">
              <div>
                <h2 className="section-title">👨‍🍳 Kitchen Preparation Counts (Today)</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Exact food portions required for Confirmed Pre-Bookings. Cook only what is booked to eliminate food waste!
                </p>
              </div>
              <button className="btn btn-outline" onClick={fetchPrepSummary}>
                🔄 Refresh Prep Counts
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dish Name</th>
                    <th>Meal Slot</th>
                    <th>Order Type</th>
                    <th>Required Portions</th>
                    <th>Distinct Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPrep ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "2rem" }}>
                        Calculating kitchen prep summary...
                      </td>
                    </tr>
                  ) : prepSummary.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "2rem" }}>
                        No confirmed pre-bookings for preparation yet today.
                      </td>
                    </tr>
                  ) : (
                    prepSummary.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700 }}>🍛 {item.food_name}</td>
                        <td>
                          <span className="badge badge-blue">{item.meal_slot}</span>
                        </td>
                        <td>
                          <span className="badge badge-warning">{item.order_type}</span>
                        </td>
                        <td style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--secondary)" }}>
                          {item.total_quantity} portions
                        </td>
                        <td>{item.total_orders} orders</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ALL BOOKINGS */}
        {/* ========================================================================= */}
        {activeTab === "bookings" && (
          <div>
            <div className="section-header">
              <div>
                <h2 className="section-title">📋 Student Pre-Bookings List</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Track all confirmed orders, cancellation requests, and verification tokens.
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["All", "Confirmed", "Cancelled"].map((st) => (
                  <button
                    key={st}
                    className={`btn btn-sm ${statusFilter === st ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setStatusFilter(st)}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Student Name</th>
                    <th>Meal Slot</th>
                    <th>Type</th>
                    <th>Items Ordered</th>
                    <th>Total (₹)</th>
                    <th>Token</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBookings ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>
                        Loading bookings from PostgreSQL...
                      </td>
                    </tr>
                  ) : filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "2rem" }}>
                        No bookings matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700, color: "var(--primary)" }}>{b.booking_number}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.user_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{b.user_email}</div>
                        </td>
                        <td>{b.meal_slot}</td>
                        <td>
                          <span className="badge badge-warning">{b.order_type}</span>
                        </td>
                        <td>
                          {b.items && b.items.length > 0 ? (
                            <div style={{ fontSize: "0.85rem" }}>
                              {b.items.map((it, i) => (
                                <div key={i}>
                                  {it.quantity}x {it.foodName}
                                </div>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ fontWeight: 700 }}>₹{parseFloat(b.total_amount).toFixed(2)}</td>
                        <td>
                          <code style={{ fontSize: "0.75rem" }}>{b.qr_token}</code>
                        </td>
                        <td>
                          <span
                            className={`badge ${b.status === "Confirmed" ? "badge-success" : "badge-danger"}`}
                          >
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 4. ADD / EDIT FOOD MODAL */}
      {showFoodModal && (
        <div className="modal-overlay" onClick={() => setShowFoodModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingFood ? "Edit Food Item" : "Add New Food Item"}</h2>
              <button className="close-btn" onClick={() => setShowFoodModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveFood}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Food Dish Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="e.g. Masala Dosa with Sambar"
                    value={foodForm.name}
                    onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="Short description of ingredients or combo"
                    value={foodForm.description}
                    onChange={(e) => setFoodForm({ ...foodForm, description: e.target.value })}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-select"
                    value={foodForm.category}
                    onChange={(e) =>
                      setFoodForm({ ...foodForm, category: e.target.value, meal_slot: e.target.value })
                    }
                  >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Evening Snacks">Evening Snacks</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    required
                    placeholder="50.00"
                    value={foodForm.price}
                    onChange={(e) => setFoodForm({ ...foodForm, price: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Available Quantity (Portions) *</label>
                  <input
                    type="number"
                    className="form-input"
                    required
                    value={foodForm.available_quantity}
                    onChange={(e) => setFoodForm({ ...foodForm, available_quantity: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Booking Deadline (HH:MM)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="12:30"
                    value={foodForm.booking_deadline}
                    onChange={(e) => setFoodForm({ ...foodForm, booking_deadline: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Food Image URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={foodForm.image_url}
                    onChange={(e) => setFoodForm({ ...foodForm, image_url: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Service Modes Allowed</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={foodForm.allow_dine_in}
                        onChange={(e) => setFoodForm({ ...foodForm, allow_dine_in: e.target.checked })}
                      />
                      🍽️ Allow Dine-in
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={foodForm.allow_parcel}
                        onChange={(e) => setFoodForm({ ...foodForm, allow_parcel: e.target.checked })}
                      />
                      📦 Allow Parcel / Takeaway
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowFoodModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingFood ? "Save Changes" : "Add Food Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ADMIN LOGIN MODAL */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">🔐 Admin Login</h2>
              <button className="close-btn" onClick={() => setShowLoginModal(false)}>
                &times;
              </button>
            </div>

            {loginError && (
              <div style={{ background: "#fee2e2", color: "#dc2626", padding: "0.65rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem" }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin}>
              <div className="form-group">
                <label className="form-label">Admin Email</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>

              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                💡 Default seeded admin credentials: <code>admin@canteen.com</code> / <code>admin123</code>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                Sign In to Admin Portal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
