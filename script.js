
let currentUser = null;
const API_URL = 'http://localhost:5000/api';
let authToken = localStorage.getItem('emlite_token') || null;
const API_KEY = "YOUR_GROQ_API_KEY";

const incomeCategories = ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'];
const expenseCategories = ['Food', 'Travel', 'Shopping', 'Bills', 'Health', 'Education', 'Entertainment', 'Other'];

// State
let transactions = [];
let currentType = 'expense';
let chatHistory = [];

// Initialize App
function init() {
    checkAuth();
    if (typeof google !== 'undefined') {
        initGoogleSignIn();
    } else {
        window.addEventListener('load', initGoogleSignIn);
    }
}

// Auth Logic
function checkAuth() {
    const savedToken = localStorage.getItem('emlite_token');
    const savedUser = localStorage.getItem('emlite_current_user');

    if (savedToken && savedUser) {
        // User logged in
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);

        document.getElementById('auth-page').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        document.getElementById('main-content').style.display = 'block';

        document.getElementById('sidebar-welcome').textContent = `Welcome, ${currentUser.fullName.split(' ')[0]}`;
        document.getElementById('topbar-fullname').textContent = currentUser.fullName;

        // Initialize app data
        setAddType('expense');
        document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
        populateCategoryFilter();

        loadTransactions().then(() => {
            navigateTo('dashboard');
        });
    } else {
        // No user logged in
        document.getElementById('auth-page').style.display = 'flex';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }
}

async function loadTransactions() {
    try {
        const res = await fetch(`${API_URL}/transactions`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        transactions = await res.json();
    } catch (err) {
        console.error('Failed to load transactions:', err);
    }
}

function toggleAuth(type) {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');

    // Clear errors
    document.getElementById('login-error').classList.remove('show');
    document.getElementById('register-error').classList.remove('show');

    if (type === 'register' || (!type && loginCard.style.display !== 'none')) {
        loginCard.style.display = 'none';
        registerCard.style.display = 'block';
    } else {
        loginCard.style.display = 'block';
        registerCard.style.display = 'none';
    }
}

function showAuthError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    if (message) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    } else {
        errorDiv.classList.remove('show');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            showAuthError('login-error', data.message); return;
        }

        // Save token and user
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('emlite_token', data.token);
        localStorage.setItem('emlite_current_user', JSON.stringify(data.user));

        document.getElementById('login-form').reset();
        showAuthError('login-error', '');
        checkAuth();
    } catch (err) {
        showAuthError('login-error', 'Server error. Is backend running?');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('reg-fullname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm').value;

    if (password !== confirmPassword) {
        showAuthError('register-error', 'Passwords do not match'); return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            showAuthError('register-error', data.message); return;
        }
        showAuthError('register-error', '');
        showToast('Account created! Please login.');
        document.getElementById('register-form').reset();
        toggleAuth('login'); // switch to login form
    } catch (err) {
        showAuthError('register-error', 'Server error. Is backend running?');
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    transactions = [];
    localStorage.removeItem('emlite_token');
    localStorage.removeItem('emlite_current_user');
    document.getElementById('login-form').reset();
    toggleAuth('login');
    checkAuth();
}

// Google OAuth Login
function initGoogleSignIn() {
    if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: "700680803344-78dekcnvifam7vnv4ui0jo3u411dgkc5.apps.googleusercontent.com",
            callback: handleGoogleLogin
        });

        const loginBtn = document.getElementById("google-signin-btn-login");
        if (loginBtn) {
            google.accounts.id.renderButton(loginBtn, {
                theme: "filled_black",
                size: "large",
                text: "continue_with",
                width: 340
            });
        }

        const regBtn = document.getElementById("google-signin-btn-register");
        if (regBtn) {
            google.accounts.id.renderButton(regBtn, {
                theme: "filled_black",
                size: "large",
                text: "continue_with",
                width: 340
            });
        }
    } else {
        console.warn("Google API client not loaded. Cannot initialize Google Sign-in.");
    }
}

async function handleGoogleLogin(googleResponse) {
    const isRegister = document.getElementById('register-card').style.display !== 'none';
    const activeErrorId = isRegister ? 'register-error' : 'login-error';

    try {
        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: googleResponse.credential })
        });
        const data = await res.json();
        if (!res.ok) {
            showAuthError(activeErrorId, data.message || 'Google login failed');
            return;
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('emlite_token', data.token);
        localStorage.setItem('emlite_current_user', JSON.stringify(data.user));

        showAuthError('login-error', '');
        showAuthError('register-error', '');
        checkAuth();
    } catch (err) {
        showAuthError(activeErrorId, 'Server error. Is backend running?');
    }
}

// Navigation Logic
function navigateTo(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Remove active class from nav links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    // Show target page
    document.getElementById(pageId).classList.add('active');
    document.querySelector(`.nav-link[data-target="${pageId}"]`).classList.add('active');

    // Update Title
    const titles = {
        dashboard: 'Dashboard',
        add: 'Add Transaction',
        history: 'Transaction History',
        reports: 'Reports & Summary'
    };
    document.getElementById('page-title').textContent = titles[pageId];

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }

    // Trigger page-specific updates
    if (pageId === 'dashboard') updateDashboard();
    if (pageId === 'history') updateHistory();
    if (pageId === 'reports') {
        // Slight delay to allow CSS transitions to trigger
        setTimeout(updateReports, 50);
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Utility Functions
function formatCurrency(num) {
    return '₹' + num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function calculateStats(txns = transactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    txns.forEach(t => {
        if (t.type === 'income') totalIncome += t.amount;
        else totalExpense += t.amount;
    });
    return {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense
    };
}

// Function saveData removed (now using backend)

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Dashboard Page Logic
function updateDashboard() {
    const { totalIncome, totalExpense, netBalance } = calculateStats();

    // Update Stat Cards
    document.getElementById('dash-income').textContent = formatCurrency(totalIncome);
    document.getElementById('dash-expense').textContent = formatCurrency(totalExpense);
    document.getElementById('dash-net').textContent = formatCurrency(netBalance);

    // Update Sidebar Balance
    const sideBal = document.getElementById('sidebar-net-balance');
    sideBal.textContent = formatCurrency(Math.abs(netBalance));
    if (netBalance < 0) {
        sideBal.textContent = '-' + sideBal.textContent;
    }

    const sideCard = document.getElementById('sidebar-balance-card');
    sideCard.classList.remove('positive', 'negative');
    if (netBalance > 0) sideCard.classList.add('positive');
    else if (netBalance < 0) sideCard.classList.add('negative');

    // Update Recent Transactions Table
    const recentTbody = document.getElementById('recent-tbody');
    recentTbody.innerHTML = '';

    const recent = [...transactions].slice(0, 5);

    if (recent.length === 0) {
        recentTbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="padding: 30px;">No recent transactions. Add one to get started!</td></tr>';
        return;
    }

    recent.forEach(t => {
        recentTbody.innerHTML += `
        <tr>
          <td><div style="font-weight: 500;">${t.desc}</div></td>
          <td><span class="badge cat-${t.category.toLowerCase()}">${t.category}</span></td>
          <td style="color: var(--muted); font-size: 13px;">${t.date}</td>
          <td class="amount-cell ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
        </tr>
      `;
    });
}

// Add Transaction Page Logic
function setAddType(type) {
    currentType = type;
    document.getElementById('btn-type-expense').classList.toggle('active', type === 'expense');
    document.getElementById('btn-type-income').classList.toggle('active', type === 'income');

    const select = document.getElementById('add-category');
    select.innerHTML = '';
    const cats = type === 'income' ? incomeCategories : expenseCategories;
    cats.forEach(c => {
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

async function handleAdd(e) {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('add-amount').value);
    const date = document.getElementById('add-date').value;
    const category = document.getElementById('add-category').value;
    const desc = document.getElementById('add-desc').value.trim();

    if (!amount || amount <= 0 || !date || !category || !desc) {
        alert('Please fill all fields correctly.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: currentType, amount, date, category, desc
            })
        });
        const newTxn = await res.json();
        transactions.unshift(newTxn);
        updateDashboard();

        // Reset Form
        document.getElementById('add-form').reset();
        document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
        setAddType('expense');

        showToast('Transaction added successfully!');
    } catch (err) {
        showToast('Error adding transaction');
    }
}

// History Page Logic
function populateCategoryFilter() {
    const select = document.getElementById('filter-category');
    const allCats = [...new Set([...incomeCategories, ...expenseCategories])].sort();
    let html = '<option value="all">All Categories</option>';
    allCats.forEach(c => {
        html += `<option value="${c}">${c}</option>`;
    });
    select.innerHTML = html;
}

function updateHistory() {
    const typeFilter = document.getElementById('filter-type').value;
    const catFilter = document.getElementById('filter-category').value;
    const searchFilter = document.getElementById('filter-search').value.toLowerCase();

    let filtered = transactions.filter(t => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (catFilter !== 'all' && t.category !== catFilter) return false;
        if (searchFilter && !t.desc.toLowerCase().includes(searchFilter)) return false;
        return true;
    });

    // Sort is not strictly needed if backend returns them sorted, but to be safe:
    filtered.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    const tbody = document.getElementById('history-tbody');
    const emptyState = document.getElementById('history-empty');
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        filtered.forEach(t => {
            tbody.innerHTML += `
          <tr>
            <td><div style="font-weight: 500;">${t.desc}</div></td>
            <td><span class="badge cat-${t.category.toLowerCase()}">${t.category}</span></td>
            <td style="color: var(--muted); font-size: 13px;">${t.date}</td>
            <td class="amount-cell ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
            <td style="text-align: center;">
              <button class="btn btn-danger" onclick="deleteTransaction('${t._id}')">Delete</button>
            </td>
          </tr>
        `;
        });
    }
}

async function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
        try {
            const res = await fetch(`${API_URL}/transactions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) {
                transactions = transactions.filter(t => t._id !== id);
                updateHistory();
                updateDashboard();
                showToast('Transaction deleted');
            } else {
                showToast('Error deleting transaction');
            }
        } catch (err) {
            showToast('Error deleting transaction');
        }
    }
}

// Reports Page Logic
function updateReports() {
    const { totalIncome, totalExpense } = calculateStats();

    // Update SVG Donut Chart (Pure SVG)
    // Note: The SVG is rotated -90deg so offset 0 is at 12 o'clock
    const donutIncome = document.getElementById('donut-income');
    const donutExpense = document.getElementById('donut-expense');

    const total = totalIncome + totalExpense;
    if (total > 0) {
        const incomePercent = (totalIncome / total) * 100;
        const expensePercent = (totalExpense / total) * 100;

        // Dasharray format: "dash gap"
        donutIncome.setAttribute('stroke-dasharray', `${incomePercent} ${100 - incomePercent}`);
        donutIncome.setAttribute('stroke-dashoffset', '0'); // Starts at 12 o'clock

        donutExpense.setAttribute('stroke-dasharray', `${expensePercent} ${100 - expensePercent}`);
        // Negative offset shifts the start point forward along the circle
        donutExpense.setAttribute('stroke-dashoffset', `-${incomePercent}`);
    } else {
        donutIncome.setAttribute('stroke-dasharray', '0 100');
        donutExpense.setAttribute('stroke-dasharray', '0 100');
    }

    // Category Breakdown Logic
    const expenses = transactions.filter(t => t.type === 'expense');
    const categoryTotals = {};

    expenses.forEach(t => {
        if (!categoryTotals[t.category]) {
            categoryTotals[t.category] = { count: 0, amount: 0 };
        }
        categoryTotals[t.category].count += 1;
        categoryTotals[t.category].amount += t.amount;
    });

    const sortedCategories = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b].amount - categoryTotals[a].amount);

    const breakdownTbody = document.getElementById('breakdown-tbody');
    breakdownTbody.innerHTML = '';

    const barChartContainer = document.getElementById('bar-chart-container');
    barChartContainer.innerHTML = '';

    if (expenses.length === 0) {
        breakdownTbody.innerHTML = '<tr><td colspan="4" class="empty-state">No expenses to display</td></tr>';
        barChartContainer.innerHTML = '<div class="empty-state" style="padding: 40px 20px;">No expense data for charts</div>';
        return;
    }

    const maxAmount = categoryTotals[sortedCategories[0]].amount;

    sortedCategories.forEach(cat => {
        const data = categoryTotals[cat];
        const percentage = ((data.amount / totalExpense) * 100).toFixed(1);

        // Build Table Row
        breakdownTbody.innerHTML += `
        <tr>
          <td><span class="badge cat-${cat.toLowerCase()}">${cat}</span></td>
          <td class="right-align">${data.count}</td>
          <td class="right-align" style="font-family: var(--font-mono); font-weight: 500;">${formatCurrency(data.amount)}</td>
          <td class="right-align" style="color: var(--muted);">${percentage}%</td>
        </tr>
      `;

        // Build Bar Chart Row (Pure CSS)
        const fillWidth = (data.amount / maxAmount) * 100;
        barChartContainer.innerHTML += `
        <div class="bar-wrapper-horizontal">
          <div class="bar-label-horiz">${cat}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${fillWidth}%">${formatCurrency(data.amount)}</div>
          </div>
        </div>
      `;
    });
}

// AI Assistant Logic (Groq API)
function toggleChat() {
    const panel = document.getElementById('chat-panel');
    panel.classList.toggle('open');

    // Focus input if opening
    if (panel.classList.contains('open')) {
        setTimeout(() => document.getElementById('chat-input').focus(), 400);
    }
}



async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    // Add user message to UI
    appendMessage('user', text);
    input.value = '';

    // Show typing indicator
    const typing = document.getElementById('typing-indicator');
    typing.classList.add('show');
    scrollToBottom();

    // Build Context
    const { totalIncome, totalExpense, netBalance } = calculateStats();

    const recent = [...transactions].slice(0, 5)
        .map(t => `${t.date} | ${t.desc} | ${t.category} | ${t.type === 'income' ? '+' : '-'}₹${t.amount}`)
        .join('\n');

    const expenses = transactions.filter(t => t.type === 'expense');
    const catMap = {};
    expenses.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
    const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => `${e[0]} (₹${e[1]})`).join(', ');

    const systemPrompt = `You are a personal finance assistant for Expense Manager Lite.
The user's current financial data:
- Total Income: ₹${totalIncome}
- Total Expenses: ₹${totalExpense}
- Net Balance: ₹${netBalance}
- Top spending categories: ${topCats || 'None'}
- Recent transactions:
${recent || 'None'}

Give concise, practical, friendly financial advice based on this data.
Keep responses under 100 words unless detailed analysis is requested.`;

    try {
        const response = await fetch(`${API_URL}/transactions/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                message: [...chatHistory, { role: 'user', content: text }],
                context: { totalIncome, totalExpense, netBalance, topCats, recent }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'API Request Failed');
        }

        const data = await response.json();
        const aiResponse = data.response;

        typing.classList.remove('show');
        appendMessage('ai', aiResponse);

        chatHistory.push({ role: 'user', content: text });
        chatHistory.push({ role: 'assistant', content: aiResponse });

    } catch (err) {
        typing.classList.remove('show');
        console.error(err);

        appendMessage('ai', `Sorry, I encountered an error: ${err.message}.`);
    }
}

function appendMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const typing = document.getElementById('typing-indicator');

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.textContent = text;

    container.insertBefore(msgDiv, typing);
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

// Receipt Scanner Logic
function handleReceiptScan(event) {
    const file = event.target.files[0];
    if (!file) return;

    const previewContainer = document.getElementById('scan-preview-container');
    const previewImg = document.getElementById('scan-preview');
    const statusDiv = document.getElementById('scan-status');

    previewContainer.style.display = 'block';
    statusDiv.textContent = '🔍 Scanning receipt...';
    statusDiv.style.color = 'var(--muted)';

    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64Data = e.target.result;
        previewImg.src = base64Data;

        const base64Image = base64Data.split(',')[1];

        try {
            const response = await fetch(`${API_URL}/transactions/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ image: base64Image })
            });

            if (!response.ok) throw new Error("API request failed");

            const data = await response.json();
            const content = data.content.trim();

            const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
            const result = JSON.parse(jsonStr);

            if (result.amount) document.getElementById('add-amount').value = result.amount;
            if (result.description) document.getElementById('add-desc').value = result.description;
            if (result.category && expenseCategories.includes(result.category)) {
                setAddType('expense');
                document.getElementById('add-category').value = result.category;
            }
            if (result.date) document.getElementById('add-date').value = result.date;

            statusDiv.textContent = '✅ Receipt scanned! Please review and save.';
            statusDiv.style.color = 'var(--income)';

        } catch (error) {
            console.error("Receipt scan error:", error);
            statusDiv.textContent = '❌ Could not read receipt. Please fill manually.';
            statusDiv.style.color = 'var(--expense)';
        }
    };
    reader.readAsDataURL(file);
}

// PDF Generation Logic
function generatePDF(title, filteredTransactions) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(45, 106, 79);
    doc.text("Expense Manager Lite", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(title, 14, 28);

    let tIncome = 0;
    let tExpense = 0;
    filteredTransactions.forEach(t => {
        if (t.type === 'income') tIncome += t.amount;
        else tExpense += t.amount;
    });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Income: ${formatCurrency(tIncome)}`, 14, 40);
    doc.text(`Total Expenses: ${formatCurrency(tExpense)}`, 80, 40);
    doc.text(`Net Balance: ${formatCurrency(tIncome - tExpense)}`, 150, 40);

    const tableData = filteredTransactions.map(t => [
        t.date,
        t.desc,
        t.category,
        t.type === 'income' ? 'Income' : 'Expense',
        formatCurrency(t.amount)
    ]);

    doc.autoTable({
        startY: 50,
        head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
        body: tableData,
        headStyles: { fillColor: [45, 106, 79] },
        alternateRowStyles: { fillColor: [247, 246, 243] },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 4) {
                if (data.row.raw[3] === 'Income') {
                    data.cell.styles.textColor = [45, 106, 79];
                } else {
                    data.cell.styles.textColor = [192, 57, 43];
                }
            }
        }
    });

    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const catMap = {};
    expenses.forEach(t => {
        if (!catMap[t.category]) catMap[t.category] = { count: 0, amount: 0 };
        catMap[t.category].count += 1;
        catMap[t.category].amount += t.amount;
    });

    const catData = Object.keys(catMap).map(cat => [
        cat,
        catMap[cat].count.toString(),
        formatCurrency(catMap[cat].amount),
        tExpense > 0 ? ((catMap[cat].amount / tExpense) * 100).toFixed(1) + '%' : '0%'
    ]);

    if (catData.length > 0) {
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15,
            head: [['Category', 'Transactions', 'Amount', '% of Expenses']],
            body: catData,
            headStyles: { fillColor: [45, 106, 79] }
        });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated on ${new Date().toLocaleDateString()} by Expense Manager Lite`, 14, doc.internal.pageSize.height - 10);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }

    return doc;
}

function downloadMonthlyPDF() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const filtered = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    const monthName = now.toLocaleString('default', { month: 'long' });
    const doc = generatePDF(`Expense Manager Lite — Monthly Report (${monthName} ${currentYear})`, filtered);
    doc.save(`EMLite-Monthly-${monthName.replace(/\s+/g, '')}${currentYear}.pdf`);
}

function downloadWeeklyPDF() {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const filtered = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= sevenDaysAgo && tDate <= now;
    });

    const doc = generatePDF(`Week of ${sevenDaysAgo.toLocaleDateString()} to ${now.toLocaleDateString()}`, filtered);

    const dateStr = now.toLocaleDateString('en-GB').replace(/\//g, '');
    doc.save(`EMLite-Weekly-${dateStr}.pdf`);
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);