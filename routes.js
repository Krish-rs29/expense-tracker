/**
 * API Router & Authentication Middleware for Multi-User Expense Tracker
 */
const db = require('./db');

const CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Salary',
  'Freelance',
  'Investment',
  'Other'
];

/**
 * Extract session token from request cookies or Auth header
 */
function extractSessionToken(req) {
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [key, val] = cookie.trim().split('=');
      if (key === 'session_token') return val;
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Handle incoming API requests
 */
function handleApiRoute(req, res, pathname, query, body) {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  const sendJson = (statusCode, data, headers = {}) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(data));
  };

  const sendError = (statusCode, message) => {
    sendJson(statusCode, { error: message });
  };

  try {
    // ============================================
    // AUTHENTICATION ENDPOINTS (PUBLIC)
    // ============================================

    // 1. POST /api/auth/register
    if (req.method === 'POST' && pathname === '/api/auth/register') {
      if (!body || !body.name || !body.email || !body.password) {
        return sendError(400, 'Full name, email, and password are required');
      }

      if (body.password.length < 6) {
        return sendError(400, 'Password must be at least 6 characters long');
      }

      if (body.password !== body.confirmPassword) {
        return sendError(400, 'Passwords do not match');
      }

      try {
        const user = db.createUser(body.name, body.email, body.password);
        const { token, expiresAt } = db.createSession(user.id);

        const cookieHeader = `session_token=${token}; HttpOnly; Path=/; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`;
        return sendJson(201, { message: 'Registration successful', user }, { 'Set-Cookie': cookieHeader });
      } catch (err) {
        return sendError(400, err.message);
      }
    }

    // 2. POST /api/auth/login
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      if (!body || !body.email || !body.password) {
        return sendError(400, 'Email and password are required');
      }

      const user = db.findUserByEmail(body.email);
      if (!user) {
        return sendError(401, 'Invalid email or password');
      }

      const isValid = db.verifyPassword(body.password, user.salt, user.password_hash);
      if (!isValid) {
        return sendError(401, 'Invalid email or password');
      }

      const { token, expiresAt } = db.createSession(user.id);
      const safeUser = { id: user.id, name: user.name, email: user.email, created_at: user.created_at };
      const cookieHeader = `session_token=${token}; HttpOnly; Path=/; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`;

      return sendJson(200, { message: 'Login successful', user: safeUser, token }, { 'Set-Cookie': cookieHeader });
    }

    // 3. POST /api/auth/logout
    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      const token = extractSessionToken(req);
      if (token) db.destroySession(token);

      const cookieHeader = `session_token=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      return sendJson(200, { message: 'Logged out successfully' }, { 'Set-Cookie': cookieHeader });
    }

    // 4. GET /api/auth/me
    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const token = extractSessionToken(req);
      const authUser = db.getSessionUser(token);
      if (!authUser) {
        return sendError(401, 'Not authenticated');
      }
      return sendJson(200, { user: authUser });
    }

    // 5. GET /api/categories
    if (req.method === 'GET' && pathname === '/api/categories') {
      return sendJson(200, { categories: CATEGORIES });
    }

    // ============================================
    // AUTHORIZATION MIDDLEWARE (PROTECTED API ROUTES)
    // ============================================
    const token = extractSessionToken(req);
    const authUser = db.getSessionUser(token);

    if (!authUser) {
      return sendError(401, 'Unauthorized: Please log in to access your financial data');
    }

    const userId = authUser.id;

    // 6. GET /api/dashboard
    if (req.method === 'GET' && pathname === '/api/dashboard') {
      const summary = db.getDashboardSummary(userId);
      return sendJson(200, summary);
    }

    // 7. GET /api/transactions
    if (req.method === 'GET' && pathname === '/api/transactions') {
      const transactions = db.getTransactions(userId, query);
      return sendJson(200, {
        count: transactions.length,
        transactions
      });
    }

    // Single item routes /api/transactions/:id
    const idMatch = pathname.match(/^\/api\/transactions\/(\d+)$/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);

      // GET /api/transactions/:id
      if (req.method === 'GET') {
        const item = db.getTransactionById(userId, id);
        if (!item) return sendError(404, 'Transaction not found');
        return sendJson(200, item);
      }

      // PUT /api/transactions/:id
      if (req.method === 'PUT') {
        const validation = validateTransactionInput(body);
        if (!validation.valid) {
          return sendError(400, validation.error);
        }

        const updated = db.updateTransaction(userId, id, body);
        if (!updated) return sendError(404, 'Transaction not found or unauthorized');
        return sendJson(200, { message: 'Transaction updated successfully', transaction: updated });
      }

      // DELETE /api/transactions/:id
      if (req.method === 'DELETE') {
        const success = db.deleteTransaction(userId, id);
        if (!success) return sendError(404, 'Transaction not found or unauthorized');
        return sendJson(200, { message: 'Transaction deleted successfully' });
      }
    }

    // 8. POST /api/transactions
    if (req.method === 'POST' && pathname === '/api/transactions') {
      const validation = validateTransactionInput(body);
      if (!validation.valid) {
        return sendError(400, validation.error);
      }

      const created = db.createTransaction(userId, body);
      return sendJson(201, { message: 'Transaction created successfully', transaction: created });
    }

    return sendError(404, 'Endpoint not found');
  } catch (err) {
    console.error('API Server Error:', err);
    return sendError(500, 'Internal Server Error: ' + err.message);
  }
}

function validateTransactionInput(data) {
  if (!data) return { valid: false, error: 'Request body cannot be empty' };

  const { amount, category, date, type } = data;

  if (type && type !== 'income' && type !== 'expense') {
    return { valid: false, error: "Transaction type must be 'income' or 'expense'" };
  }

  if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }

  if (!category || typeof category !== 'string' || !category.trim()) {
    return { valid: false, error: 'Category is required' };
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { valid: false, error: 'Date is required and must be in YYYY-MM-DD format' };
  }

  return { valid: true };
}

module.exports = { handleApiRoute };
