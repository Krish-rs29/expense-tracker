/**
 * Database Module for Multi-User Expense Tracker
 * Powered by Node 22 native node:sqlite and node:crypto
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[match[1]] = value.trim();
      }
    });
  }
}

loadEnv();

const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const defaultDbName = isServerless ? path.join('/tmp', 'expenses.db') : 'expenses.db';
const dbPath = process.env.DB_PATH ? path.resolve(__dirname, process.env.DB_PATH) : (isServerless ? '/tmp/expenses.db' : path.resolve(__dirname, 'expenses.db'));
const db = new DatabaseSync(dbPath);

if (!isServerless) {
  db.exec('PRAGMA journal_mode = WAL;');
}
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize Multi-User Database Schema
 */
function initDatabase() {
  // 1. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Transactions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')) DEFAULT 'expense',
      amount REAL NOT NULL CHECK(amount > 0),
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Schema Migration: Ensure user_id column exists
  try {
    const columns = db.prepare("PRAGMA table_info(transactions)").all();
    const hasUserId = columns.some(c => c.name === 'user_id');
    if (!hasUserId) {
      db.exec("ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;");
    }
  } catch (e) {
    // Ignore migration error if column exists
  }

  // 4. Indices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_cat ON transactions(user_id, category);
  `);
}

// ============================================
// PASSWORD HASHING (CRYPTO SCRYPT)
// ============================================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, hash) {
  const hashBuffer = Buffer.from(hash, 'hex');
  const targetBuffer = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(hashBuffer, targetBuffer);
}

// ============================================
// USER & SESSION OPERATIONS
// ============================================
function createUser(name, email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const { hash, salt } = hashPassword(password);
  const stmt = db.prepare('INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)');
  const result = stmt.run(name.trim(), normalizedEmail, hash, salt);

  return findUserById(result.lastInsertRowid);
}

function findUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
}

function findUserById(id) {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(id);
  return user || null;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
  stmt.run(token, userId, expiresAt);

  return { token, expiresAt };
}

function getSessionUser(token) {
  if (!token) return null;
  const stmt = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.name, u.email, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `);
  const row = stmt.get(token);

  if (!row) return null;

  if (new Date(row.expires_at) < new Date()) {
    destroySession(token);
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: row.created_at
  };
}

function destroySession(token) {
  if (!token) return;
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
}

// ============================================
// USER-ISOLATED TRANSACTION OPERATIONS
// ============================================
function roundTwo(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function getTransactions(userId, filters = {}) {
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [userId];

  if (filters.type && (filters.type === 'income' || filters.type === 'expense')) {
    sql += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters.category && filters.category !== 'All') {
    sql += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.startDate && /^\d{4}-\d{2}-\d{2}$/.test(filters.startDate)) {
    sql += ' AND date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate && /^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)) {
    sql += ' AND date <= ?';
    params.push(filters.endDate);
  }

  if (filters.search && filters.search.trim()) {
    sql += ' AND (description LIKE ? OR category LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term);
  }

  const sortBy = filters.sortBy === 'amount' ? 'amount' : 'date';
  const order = filters.order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortBy} ${order}, id DESC`;

  const stmt = db.prepare(sql);
  return stmt.all(...params).map(item => ({
    ...item,
    amount: roundTwo(item.amount)
  }));
}

function getTransactionById(userId, id) {
  const stmt = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?');
  const item = stmt.get(id, userId);
  if (!item) return null;
  return { ...item, amount: roundTwo(item.amount) };
}

function createTransaction(userId, data) {
  const stmt = db.prepare(`
    INSERT INTO transactions (user_id, type, amount, category, description, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    userId,
    data.type || 'expense',
    roundTwo(data.amount),
    data.category,
    data.description || '',
    data.date
  );

  return getTransactionById(userId, result.lastInsertRowid);
}

function updateTransaction(userId, id, data) {
  const stmt = db.prepare(`
    UPDATE transactions
    SET type = ?, amount = ?, category = ?, description = ?, date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `);

  const result = stmt.run(
    data.type || 'expense',
    roundTwo(data.amount),
    data.category,
    data.description || '',
    data.date,
    id,
    userId
  );

  if (result.changes === 0) return null;
  return getTransactionById(userId, id);
}

function deleteTransaction(userId, id) {
  const stmt = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?');
  const result = stmt.run(id, userId);
  return result.changes > 0;
}

/**
 * Get calculated dashboard statistics strictly for authenticated userId
 */
function getDashboardSummary(userId) {
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalIncomeStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income'");
  const totalExpenseStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense'");

  const totalIncome = roundTwo(totalIncomeStmt.get(userId).total);
  const totalExpense = roundTwo(totalExpenseStmt.get(userId).total);
  const netBalance = roundTwo(totalIncome - totalExpense);

  const monthlyIncomeStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' AND date LIKE ?");
  const monthlyExpenseStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date LIKE ?");

  const monthlyIncome = roundTwo(monthlyIncomeStmt.get(userId, `${currentMonthPrefix}%`).total);
  const monthlyExpense = roundTwo(monthlyExpenseStmt.get(userId, `${currentMonthPrefix}%`).total);
  const monthlySavings = roundTwo(monthlyIncome - monthlyExpense);
  const savingsRate = monthlyIncome > 0 ? roundTwo((monthlySavings / monthlyIncome) * 100) : 0;

  const monthlyBudgetTarget = Number(process.env.MONTHLY_BUDGET_TARGET) || 50000;
  const budgetSpentPercent = roundTwo((monthlyExpense / monthlyBudgetTarget) * 100);
  const budgetRemaining = roundTwo(monthlyBudgetTarget - monthlyExpense);

  const categoryStmt = db.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE user_id = ? AND type = 'expense' AND date LIKE ?
    GROUP BY category
    ORDER BY total DESC
  `);
  const categoryBreakdown = categoryStmt.all(userId, `${currentMonthPrefix}%`).map(c => ({
    category: c.category,
    total: roundTwo(c.total)
  }));

  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleString('en-US', { month: 'short' });

    const inc = roundTwo(monthlyIncomeStmt.get(userId, `${yearMonth}%`).total);
    const exp = roundTwo(monthlyExpenseStmt.get(userId, `${yearMonth}%`).total);

    monthlyTrend.push({
      month: monthLabel,
      yearMonth,
      income: inc,
      expense: exp
    });
  }

  return {
    totalBalance: netBalance,
    totalIncome,
    totalExpense,
    monthlyIncome,
    monthlyExpense,
    monthlySavings,
    savingsRate,
    monthlyBudgetTarget,
    budgetSpentPercent,
    budgetRemaining,
    categoryBreakdown,
    monthlyTrend
  };
}

initDatabase();

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  createSession,
  getSessionUser,
  destroySession,
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getDashboardSummary
};
