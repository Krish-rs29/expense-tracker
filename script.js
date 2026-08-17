/**
 * Frontend Application Controller for Smart Multi-User Finance Tracker
 * Handles Authentication, Session Management, and User Data Isolation
 */

// ============================================
// STATE & CONFIGURATION
// ============================================
const API_BASE = '/api';
const CURRENCY_SYMBOL = '₹';
const CATEGORY_COLORS = {
  Food: '#f59e0b',
  Transport: '#3b82f6',
  Shopping: '#ec4899',
  Bills: '#ef4444',
  Entertainment: '#8b5cf6',
  Salary: '#10b981',
  Freelance: '#06b6d4',
  Investment: '#6366f1',
  Other: '#64748b'
};

let appState = {
  user: null,
  transactions: [],
  dashboard: null,
  filters: {
    search: '',
    type: 'all',
    category: 'All',
    startDate: '',
    endDate: ''
  },
  editingId: null,
  theme: localStorage.getItem('theme') || 'light'
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
  html: document.documentElement,
  themeToggle: document.getElementById('theme-toggle'),
  exportCsvBtn: document.getElementById('export-csv-btn'),
  errorBanner: document.getElementById('error-banner'),
  
  // Auth Elements
  authView: document.getElementById('auth-view'),
  appView: document.getElementById('app-view'),
  userProfilePill: document.getElementById('user-profile-pill'),
  userAvatarChar: document.getElementById('user-avatar-char'),
  userNameDisplay: document.getElementById('user-name-display'),
  logoutBtn: document.getElementById('logout-btn'),
  welcomeHeading: document.getElementById('welcome-heading'),

  tabLogin: document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),
  authError: document.getElementById('auth-error'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginSubmitBtn: document.getElementById('login-submit-btn'),
  regName: document.getElementById('reg-name'),
  regEmail: document.getElementById('reg-email'),
  regPassword: document.getElementById('reg-password'),
  regConfirmPassword: document.getElementById('reg-confirm-password'),
  regSubmitBtn: document.getElementById('reg-submit-btn'),

  // KPI Elements
  netBalance: document.getElementById('net-balance'),
  totalIncome: document.getElementById('total-income'),
  totalExpense: document.getElementById('total-expense'),
  monthlySavings: document.getElementById('monthly-savings'),
  savingsRateBadge: document.getElementById('savings-rate-badge'),
  monthlyIncomeSub: document.getElementById('monthly-income-sub'),
  monthlyExpenseSub: document.getElementById('monthly-expense-sub'),

  // Budget Progress Elements
  budgetLabel: document.getElementById('budget-label'),
  budgetPercent: document.getElementById('budget-percent'),
  budgetProgressFill: document.getElementById('budget-progress-fill'),

  // Charts
  categoryChart: document.getElementById('category-chart'),
  categoryLegend: document.getElementById('category-legend'),
  trendChart: document.getElementById('trend-chart'),

  // Form Elements
  form: document.getElementById('expense-form'),
  formHeading: document.getElementById('form-heading'),
  editIdInput: document.getElementById('edit-id'),
  amountInput: document.getElementById('amount'),
  categoryInput: document.getElementById('category'),
  descriptionInput: document.getElementById('description'),
  dateInput: document.getElementById('date'),
  submitBtn: document.getElementById('submit-btn'),
  cancelEditBtn: document.getElementById('cancel-edit-btn'),

  // List & Filters
  searchInput: document.getElementById('search-input'),
  filterType: document.getElementById('filter-type'),
  filterCategory: document.getElementById('filter-category'),
  startDateInput: document.getElementById('start-date'),
  endDateInput: document.getElementById('end-date'),
  resetFiltersBtn: document.getElementById('reset-filters-btn'),
  transactionCount: document.getElementById('transaction-count'),
  loadingState: document.getElementById('loading-state'),
  emptyState: document.getElementById('empty-state'),
  tableWrapper: document.getElementById('table-wrapper'),
  expenseList: document.getElementById('expense-list'),
  toastContainer: document.getElementById('toast-container')
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setDefaultDate();
  setupEventListeners();
  checkAuthSession();
});

function initTheme() {
  elements.html.setAttribute('data-theme', appState.theme);
  elements.themeToggle.querySelector('.theme-icon').textContent = appState.theme === 'dark' ? '☀️' : '🌙';
}

function setDefaultDate() {
  elements.dateInput.value = new Date().toISOString().split('T')[0];
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Theme Toggle
  elements.themeToggle.addEventListener('click', () => {
    appState.theme = appState.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', appState.theme);
    initTheme();
    if (appState.dashboard) {
      renderCategoryChart(appState.dashboard.categoryBreakdown);
      renderTrendChart(appState.dashboard.monthlyTrend);
    }
  });

  // Auth Tab Switcher
  elements.tabLogin.addEventListener('click', () => switchAuthTab('login'));
  elements.tabRegister.addEventListener('click', () => switchAuthTab('register'));

  // Auth Forms
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.registerForm.addEventListener('submit', handleRegister);
  elements.logoutBtn.addEventListener('click', handleLogout);

  // Show/Hide Password Toggle
  document.querySelectorAll('.btn-toggle-password').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        btn.textContent = type === 'password' ? '👁️' : '🙈';
      }
    });
  });

  // Type Radio Smart Category Filter
  const typeRadios = elements.form.querySelectorAll('input[name="type"]');
  typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      if (selectedType === 'income') {
        if (['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment'].includes(elements.categoryInput.value)) {
          elements.categoryInput.value = 'Salary';
        }
      } else {
        if (['Salary', 'Freelance', 'Investment'].includes(elements.categoryInput.value)) {
          elements.categoryInput.value = 'Food';
        }
      }
    });
  });

  // Transaction Form Submit & Cancel
  elements.form.addEventListener('submit', handleFormSubmit);
  elements.cancelEditBtn.addEventListener('click', resetForm);

  // Filters & Search
  let searchTimeout;
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      appState.filters.search = e.target.value;
      loadTransactions();
    }, 300);
  });

  elements.filterType.addEventListener('change', (e) => {
    appState.filters.type = e.target.value;
    loadTransactions();
  });

  elements.filterCategory.addEventListener('change', (e) => {
    appState.filters.category = e.target.value;
    loadTransactions();
  });

  elements.startDateInput.addEventListener('change', (e) => {
    appState.filters.startDate = e.target.value;
    loadTransactions();
  });

  elements.endDateInput.addEventListener('change', (e) => {
    appState.filters.endDate = e.target.value;
    loadTransactions();
  });

  elements.resetFiltersBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.filterType.value = 'all';
    elements.filterCategory.value = 'All';
    elements.startDateInput.value = '';
    elements.endDateInput.value = '';
    appState.filters = { search: '', type: 'all', category: 'All', startDate: '', endDate: '' };
    loadTransactions();
  });

  // Export CSV
  elements.exportCsvBtn.addEventListener('click', exportToCsv);
}

// ============================================
// AUTHENTICATION FLOWS
// ============================================
async function checkAuthSession() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!res.ok) {
      showAuthView();
      return;
    }
    const data = await res.json();
    appState.user = data.user;
    showAppView();
    loadApplicationData();
  } catch (err) {
    showAuthView();
  }
}

function switchAuthTab(tab) {
  hideAuthError();
  if (tab === 'login') {
    elements.tabLogin.classList.add('active');
    elements.tabRegister.classList.remove('active');
    elements.loginForm.classList.remove('hidden');
    elements.registerForm.classList.add('hidden');
    document.getElementById('auth-title').textContent = 'Welcome to FinanceTracker';
    document.getElementById('auth-subtitle').textContent = 'Sign in to manage your private financial records';
  } else {
    elements.tabRegister.classList.add('active');
    elements.tabLogin.classList.remove('active');
    elements.registerForm.classList.remove('hidden');
    elements.loginForm.classList.add('hidden');
    document.getElementById('auth-title').textContent = 'Create your Account';
    document.getElementById('auth-subtitle').textContent = 'Start tracking your private income & expenses';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  hideAuthError();

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  if (!email || !password) {
    showAuthError('Please enter your email and password');
    return;
  }

  elements.loginSubmitBtn.disabled = true;
  elements.loginSubmitBtn.textContent = 'Signing in...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    appState.user = data.user;
    showToast(`Welcome back, ${data.user.name}!`, 'success');
    showAppView();
    loadApplicationData();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    elements.loginSubmitBtn.disabled = false;
    elements.loginSubmitBtn.textContent = 'Sign In';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  hideAuthError();

  const name = elements.regName.value.trim();
  const email = elements.regEmail.value.trim();
  const password = elements.regPassword.value;
  const confirmPassword = elements.regConfirmPassword.value;

  if (!name || !email || !password || !confirmPassword) {
    showAuthError('Please complete all required fields');
    return;
  }

  if (password !== confirmPassword) {
    showAuthError('Passwords do not match');
    return;
  }

  elements.regSubmitBtn.disabled = true;
  elements.regSubmitBtn.textContent = 'Creating account...';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password, confirmPassword })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    appState.user = data.user;
    showToast(`Account created! Welcome, ${data.user.name}`, 'success');
    showAppView();
    loadApplicationData();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    elements.regSubmitBtn.disabled = false;
    elements.regSubmitBtn.textContent = 'Create Account';
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch (e) {
    // Ignore error on logout
  }
  appState.user = null;
  appState.transactions = [];
  appState.dashboard = null;
  showToast('Logged out successfully', 'success');
  showAuthView();
}

function showAuthView() {
  elements.authView.classList.remove('hidden');
  elements.appView.classList.add('hidden');
  elements.userProfilePill.classList.add('hidden');
}

function showAppView() {
  elements.authView.classList.add('hidden');
  elements.appView.classList.remove('hidden');

  if (appState.user) {
    elements.userProfilePill.classList.remove('hidden');
    elements.userNameDisplay.textContent = appState.user.name;
    elements.userAvatarChar.textContent = appState.user.name.charAt(0).toUpperCase();
    elements.welcomeHeading.textContent = `Welcome back, ${appState.user.name.split(' ')[0]}!`;
  }
}

function showAuthError(msg) {
  elements.authError.textContent = msg;
  elements.authError.classList.remove('hidden');
}

function hideAuthError() {
  elements.authError.classList.add('hidden');
  elements.authError.textContent = '';
}

// ============================================
// API & DATA FETCHING (AUTHENTICATED)
// ============================================
async function loadApplicationData() {
  showLoading();
  hideError();

  try {
    await Promise.all([loadDashboard(), loadTransactions()]);
  } catch (err) {
    if (err.message.includes('Unauthorized')) {
      handleLogout();
    } else {
      showError('Could not connect to server: ' + err.message);
    }
  } finally {
    hideLoading();
  }
}

async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/dashboard`, { credentials: 'include' });
    if (res.status === 401) {
      showAuthView();
      return;
    }
    if (!res.ok) throw new Error('Failed to fetch dashboard statistics');
    const data = await res.json();
    appState.dashboard = data;
    renderDashboard(data);
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

async function loadTransactions() {
  try {
    const queryParams = new URLSearchParams();
    if (appState.filters.search) queryParams.append('search', appState.filters.search);
    if (appState.filters.type && appState.filters.type !== 'all') queryParams.append('type', appState.filters.type);
    if (appState.filters.category && appState.filters.category !== 'All') queryParams.append('category', appState.filters.category);
    if (appState.filters.startDate) queryParams.append('startDate', appState.filters.startDate);
    if (appState.filters.endDate) queryParams.append('endDate', appState.filters.endDate);

    const res = await fetch(`${API_BASE}/transactions?${queryParams.toString()}`, { credentials: 'include' });
    if (res.status === 401) {
      showAuthView();
      return;
    }
    if (!res.ok) throw new Error('Failed to fetch transactions');
    const data = await res.json();

    appState.transactions = data.transactions || [];
    renderTransactionsTable(appState.transactions);
  } catch (err) {
    console.error('Error loading transactions:', err);
  }
}

// ============================================
// FORM ACTIONS (CREATE / EDIT)
// ============================================
async function handleFormSubmit(e) {
  e.preventDefault();

  const type = elements.form.querySelector('input[name="type"]:checked').value;
  const amount = parseFloat(elements.amountInput.value);
  const category = elements.categoryInput.value;
  const description = elements.descriptionInput.value.trim();
  const date = elements.dateInput.value;

  if (!amount || amount <= 0 || !category || !date) {
    showToast('Please fill in all required fields correctly', 'error');
    return;
  }

  const payload = { type, amount, category, description, date };
  elements.submitBtn.disabled = true;

  try {
    let res;
    if (appState.editingId) {
      res = await fetch(`${API_BASE}/transactions/${appState.editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Server error saving transaction');
    }

    showToast(
      appState.editingId ? 'Transaction updated successfully!' : 'Transaction added successfully!',
      'success'
    );

    resetForm();
    await loadApplicationData();
  } catch (err) {
    console.error('Save error:', err);
    showToast(err.message, 'error');
  } finally {
    elements.submitBtn.disabled = false;
  }
}

function startEditTransaction(item) {
  appState.editingId = item.id;
  elements.editIdInput.value = item.id;
  elements.formHeading.textContent = 'Edit Transaction';
  elements.submitBtn.textContent = 'Update Transaction';
  elements.cancelEditBtn.classList.remove('hidden');

  const radio = elements.form.querySelector(`input[name="type"][value="${item.type}"]`);
  if (radio) radio.checked = true;

  elements.amountInput.value = item.amount;
  elements.categoryInput.value = item.category;
  elements.descriptionInput.value = item.description || '';
  elements.dateInput.value = item.date;

  elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  appState.editingId = null;
  elements.editIdInput.value = '';
  elements.formHeading.textContent = 'Add New Transaction';
  elements.submitBtn.textContent = 'Add Transaction';
  elements.cancelEditBtn.classList.add('hidden');
  elements.form.reset();
  setDefaultDate();
}

async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;

  try {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to delete transaction');
    }

    showToast('Transaction deleted successfully', 'success');
    await loadApplicationData();
  } catch (err) {
    console.error('Delete error:', err);
    showToast(err.message, 'error');
  }
}

// ============================================
// RENDERING FUNCTIONS
// ============================================
function renderDashboard(data) {
  elements.netBalance.textContent = formatCurrency(data.totalBalance);
  elements.totalIncome.textContent = formatCurrency(data.totalIncome);
  elements.totalExpense.textContent = formatCurrency(data.totalExpense);
  elements.monthlySavings.textContent = formatCurrency(data.monthlySavings);
  
  elements.savingsRateBadge.textContent = `${data.savingsRate}% Rate`;
  elements.monthlyIncomeSub.textContent = `This month: ${formatCurrency(data.monthlyIncome)}`;
  elements.monthlyExpenseSub.textContent = `This month: ${formatCurrency(data.monthlyExpense)}`;

  if (data.monthlyBudgetTarget) {
    const targetK = Math.round(data.monthlyBudgetTarget / 1000);
    elements.budgetLabel.textContent = `Budget Goal (₹${targetK}k)`;
    const percent = Math.min(data.budgetSpentPercent || 0, 100);
    elements.budgetPercent.textContent = `${data.budgetSpentPercent}%`;
    elements.budgetProgressFill.style.width = `${percent}%`;

    elements.budgetProgressFill.className = 'progress-bar-fill';
    if (percent > 90) {
      elements.budgetProgressFill.classList.add('danger');
    } else if (percent > 70) {
      elements.budgetProgressFill.classList.add('warning');
    }
  }

  renderCategoryChart(data.categoryBreakdown);
  renderTrendChart(data.monthlyTrend);
}

function renderTransactionsTable(list) {
  elements.transactionCount.textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
  elements.expenseList.innerHTML = '';

  if (list.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.tableWrapper.classList.add('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.tableWrapper.classList.remove('hidden');

  list.forEach((item) => {
    const tr = document.createElement('tr');

    const formattedDate = new Date(item.date + 'T00:00:00').toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const isExpense = item.type === 'expense';
    const amountPrefix = isExpense ? '-' : '+';
    const amountClass = isExpense ? 'text-danger' : 'text-success';

    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td>
        <span class="type-badge ${isExpense ? 'type-badge-expense' : 'type-badge-income'}">
          ${item.type}
        </span>
      </td>
      <td>
        <span class="category-badge" style="background-color: ${CATEGORY_COLORS[item.category] || '#6366f1'}22; color: ${CATEGORY_COLORS[item.category] || '#6366f1'}">
          ${escapeHtml(item.category)}
        </span>
      </td>
      <td>${escapeHtml(item.description || '—')}</td>
      <td class="text-right ${amountClass}" style="font-weight: 600;">
        ${amountPrefix}${formatCurrency(item.amount)}
      </td>
      <td class="text-center">
        <button class="btn-edit-icon" title="Edit">✏️</button>
        <button class="btn-danger-icon" title="Delete">🗑️</button>
      </td>
    `;

    tr.querySelector('.btn-edit-icon').addEventListener('click', () => startEditTransaction(item));
    tr.querySelector('.btn-danger-icon').addEventListener('click', () => deleteTransaction(item.id));

    elements.expenseList.appendChild(tr);
  });
}

// ============================================
// CANVAS CHARTS (CATEGORY DONUT & TREND BARS)
// ============================================
function renderCategoryChart(breakdown = []) {
  const canvas = elements.categoryChart;
  const ctx = canvas.getContext('2d');

  const width = canvas.parentElement.clientWidth || 300;
  const height = 200;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  ctx.clearRect(0, 0, width, height);
  elements.categoryLegend.innerHTML = '';

  if (!breakdown || breakdown.length === 0) {
    ctx.fillStyle = appState.theme === 'dark' ? '#94a3b8' : '#64748b';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No spending recorded this month', width / 2, height / 2);
    return;
  }

  const totalSpent = breakdown.reduce((sum, b) => sum + b.total, 0);
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(width, height) / 2 - 10;
  const innerRadius = outerRadius * 0.6;

  let startAngle = -Math.PI / 2;

  breakdown.forEach((item) => {
    const sliceAngle = (item.total / totalSpent) * (Math.PI * 2);
    const color = CATEGORY_COLORS[item.category] || '#6366f1';

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle += sliceAngle;

    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `
      <span class="legend-dot" style="background-color: ${color}"></span>
      <span>${item.category}: <strong>${formatCurrency(item.total)}</strong></span>
    `;
    elements.categoryLegend.appendChild(li);
  });
}

function renderTrendChart(monthlyTrend = []) {
  const canvas = elements.trendChart;
  const ctx = canvas.getContext('2d');

  const width = canvas.parentElement.clientWidth || 300;
  const height = 200;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  ctx.clearRect(0, 0, width, height);

  if (!monthlyTrend || monthlyTrend.length === 0) return;

  const padding = 35;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxVal = Math.max(
    ...monthlyTrend.flatMap(m => [m.income, m.expense]),
    1000
  );

  const groupWidth = chartWidth / monthlyTrend.length;
  const barWidth = Math.min(groupWidth * 0.35, 14);

  monthlyTrend.forEach((m, idx) => {
    const xGroup = padding + idx * groupWidth + groupWidth / 2;

    // Income Bar (Green)
    const incHeight = (m.income / maxVal) * chartHeight;
    const incX = xGroup - barWidth - 2;
    const incY = height - padding - incHeight;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(incX, incY, barWidth, incHeight, [4, 4, 0, 0]);
    ctx.fill();

    // Expense Bar (Red)
    const expHeight = (m.expense / maxVal) * chartHeight;
    const expX = xGroup + 2;
    const expY = height - padding - expHeight;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(expX, expY, barWidth, expHeight, [4, 4, 0, 0]);
    ctx.fill();

    // Month Label
    ctx.fillStyle = appState.theme === 'dark' ? '#94a3b8' : '#64748b';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.month, xGroup, height - 12);
  });
}

// ============================================
// CSV EXPORT UTILITY
// ============================================
function exportToCsv() {
  if (appState.transactions.length === 0) {
    showToast('No transactions to export', 'error');
    return;
  }

  const headers = ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount (INR)'];
  const rows = appState.transactions.map(t => [
    t.id,
    t.date,
    t.type,
    `"${t.category.replace(/"/g, '""')}"`,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    t.amount
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `FinanceTracker_Export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Exported CSV file successfully!', 'success');
}

// ============================================
// HELPER UTILITIES
// ============================================
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading() {
  elements.loadingState.classList.remove('hidden');
  elements.emptyState.classList.add('hidden');
  elements.tableWrapper.classList.add('hidden');
}

function hideLoading() {
  elements.loadingState.classList.add('hidden');
}

function showError(msg) {
  elements.errorBanner.textContent = msg;
  elements.errorBanner.classList.remove('hidden');
}

function hideError() {
  elements.errorBanner.classList.add('hidden');
  elements.errorBanner.textContent = '';
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : '⚠️'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
