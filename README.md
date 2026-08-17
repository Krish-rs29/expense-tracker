# Smart Multi-User Personal Finance & Expense Tracker

A modern, responsive, intuitive, and production-quality **Secure Multi-User Personal Finance Application** built with Node.js, SQLite, Vanilla HTML5, CSS3, and JavaScript ES2024.

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/Node.js-v22+-green.svg)
![Security](https://img.shields.io/badge/Security-Multi--User%20Isolated-success.svg)
![Database](https://img.shields.io/badge/Database-SQLite3-lightgrey.svg)
![Currency](https://img.shields.io/badge/Currency-INR%20%28%E2%82%B9%29-orange.svg)

---

## 🌟 Key Features & Multi-User Architecture

* **Secure Authentication & Registration**: Complete sign up and login flows with email validation and strong password requirements.
* **100% Data Isolation**: Every transaction, income record, category breakdown, budget metric, and trend chart belongs strictly to the authenticated user.
* **Cryptographic Security**:
  * Passwords hashed using Node 22 native `node:crypto.scryptSync` with random 16-byte salts and constant-time comparison (`crypto.timingSafeEqual`).
  * Session management powered by cryptographically random 32-byte session tokens delivered via **HTTP-Only, SameSite=Lax** cookies.
  * **IDOR (Insecure Direct Object Reference) Protection**: All database queries strictly enforce `WHERE user_id = ? AND id = ?`, preventing unauthorized data access or modification.
* **Executive KPI Dashboard**: Live tracking of **Net Balance**, **Total Income**, **Total Expenses**, and **Monthly Savings Rate (%)** formatted in Indian Rupee (**INR ₹**).
* **Interactive Data Visualization**:
  * **Category Expense Breakdown**: Canvas donut chart visualizing spending per category.
  * **6-Month Financial Trend**: Canvas bar chart comparing Income vs Expense over the last 6 months.
* **Full Transaction CRUD & Search**: Add, Edit (pre-filled modal), Delete, Search, and Date Range Filter transactions.
* **CSV Data Export**: One-click export of private financial records to `.csv`.
* **Dark / Light Theme Toggle**: Persistent theme switcher stored in `localStorage`.

---

## 🏗️ Technology Stack

### Backend
* **Runtime**: Node.js (v22+)
* **HTTP Server**: Native `node:http` module
* **Database Engine**: Native `node:sqlite` (`expenses.db` SQLite3 engine)
* **Security & Crypto**: Native `node:crypto` (`scryptSync`, `randomBytes`, `timingSafeEqual`)

### Frontend
* **UI Markup**: HTML5 with semantic tags & ARIA accessibility attributes
* **Styling**: CSS3 (Vanilla CSS variables, responsive grid/flexbox, glassmorphism, Dark/Light mode)
* **Logic**: Vanilla JavaScript ES2024 (DOM, Fetch API with credentials, Canvas chart rendering)

---

## 📊 Database Schema (`expenses.db`)

```sql
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table (Per-User Isolated)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')) DEFAULT 'expense',
  amount REAL NOT NULL CHECK(amount > 0),
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date);
```

---

## 🔌 API Endpoints Documentation

### Authentication APIs (Public)
| Method | Endpoint | Description | Request Payload / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account | `{ name, email, password, confirmPassword }` |
| `POST` | `/api/auth/login` | Authenticate user & start session | `{ email, password }` |
| `POST` | `/api/auth/logout` | Terminate session & clear cookies | None |
| `GET` | `/api/auth/me` | Fetch active authenticated user profile | Cookie / Header Session Token |

### Protected User Financial APIs (Requires Authentication)
| Method | Endpoint | Description | Query / Body Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard` | Returns authenticated user's balance, income, expenses, budget & trends | None |
| `GET` | `/api/transactions` | Fetch user's filtered transactions | `?search=...&type=...&category=...&startDate=...&endDate=...` |
| `GET` | `/api/transactions/:id` | Fetch user's transaction by ID | None |
| `POST` | `/api/transactions` | Create transaction for current user | `{ type, amount, category, description, date }` |
| `PUT` | `/api/transactions/:id` | Update transaction owned by user | `{ type, amount, category, description, date }` |
| `DELETE` | `/api/transactions/:id` | Delete transaction owned by user | None |
| `GET` | `/api/categories` | Get category list | None |

---

## 🚀 How to Run the Application

### Option 1 — Quick Launch Script (Recommended)
Simply run the included helper batch script from PowerShell or Command Prompt, or double-click `start.bat`:
```cmd
.\start.bat
```

### Option 2 — Direct Node Execution
Run using the installed Node runtime path:
```powershell
& 'C:\Users\Dell\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe' server.js
```

### Option 3 — Standard NPM (if Node/NPM added to system PATH)
```bash
npm start
```

Once started, open your browser and navigate to:
👉 **`http://localhost:3000`**

---

## 🔒 Security Architecture Highlights
1. **Zero Plaintext Passwords**: Passwords are never stored or logged in plain text.
2. **HTTP-Only Cookies**: Session tokens are transmitted in `HttpOnly; SameSite=Lax` cookies, preventing XSS token theft.
3. **Backend Ownership Enforcement**: Ownership checks (`WHERE user_id = ?`) are performed directly in SQL queries on the backend. Client-supplied user IDs are ignored.
4. **Parameterized SQL Queries**: All database operations use prepared statements to block 100% of SQL injection attempts.

---

## 📄 License
This project is licensed under the MIT License.
