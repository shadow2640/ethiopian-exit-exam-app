const API_URL = '/api';

const state = {
  token: localStorage.getItem('exitprep_token') || null,
  user: JSON.parse(localStorage.getItem('exitprep_user')) || null,
  departments: [],
  practice: {
    questions: [],
    currentIndex: 0,
    score: 0,
    mode: null,
    answers: [],
    hitPaywall: false,
    startTime: null,
    type: null,
    subjectId: null,
    deptId: null
  }
};

function saveUser(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('exitprep_token', token);
  localStorage.setItem('exitprep_user', JSON.stringify(user));
  updateNav();
}

function clearUser() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('exitprep_token');
  localStorage.removeItem('exitprep_user');
  updateNav();
}

// Progress and Bookmarks
function getProgress() {
  return JSON.parse(localStorage.getItem('exitprep_progress')) || {};
}
function saveProgress(progress) {
  localStorage.setItem('exitprep_progress', JSON.stringify(progress));
}
function getBookmarks() {
  return JSON.parse(localStorage.getItem('exitprep_bookmarks')) || [];
}
function saveBookmarks(bookmarks) {
  localStorage.setItem('exitprep_bookmarks', JSON.stringify(bookmarks));
}

// API Utilities
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await res.json();
    
    if (res.status === 403 && data.error === 'SESSION_EXPIRED') {
      showToast('Session expired. Please log in again.', 'error');
      clearUser();
      window.location.hash = '#login';
      throw new Error('Session expired');
    }
    
    if (!res.ok) {
      throw { status: res.status, data };
    }
    return data;
  } catch (err) {
    if (err.status) throw err;
    console.error('API Error:', err);
    throw { status: 500, data: { error: 'Network error' } };
  }
}

// UI Utilities
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function updateNav() {
  const loggedIn = !!state.user;
  document.getElementById('nav-profile').classList.toggle('hidden', !loggedIn);
  document.getElementById('nav-progress').classList.toggle('hidden', !loggedIn);
  document.getElementById('nav-bookmarks').classList.toggle('hidden', !loggedIn);
  const isAdmin = loggedIn && (state.user.role === 'admin' || state.user.role === 'owner');
  document.getElementById('nav-admin').classList.toggle('hidden', !isAdmin);
  document.getElementById('nav-login').classList.toggle('hidden', loggedIn);
  document.getElementById('nav-register').classList.toggle('hidden', loggedIn);
  document.getElementById('nav-logout').classList.toggle('hidden', !loggedIn);
}

document.getElementById('nav-logout').addEventListener('click', (e) => {
  e.preventDefault();
  clearUser();
  window.location.hash = '#home';
  showToast('Logged out successfully', 'success');
});

// Auto-Hiding Navbar
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  const navbar = document.getElementById('navbar');
  if (currentScroll > 50 && currentScroll > lastScroll) {
    navbar.classList.add('nav-hidden');
  } else {
    navbar.classList.remove('nav-hidden');
  }
  lastScroll = currentScroll;
});

// Mobile Menu
const mobileBtn = document.getElementById('mobile-menu-btn');
const navLinks = document.getElementById('nav-links');
mobileBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.addEventListener('click', () => navLinks.classList.remove('open'));

// Router
function handleRoute() {
  const hash = window.location.hash || '#home';
  const parts = hash.substring(1).split('/');
  const route = parts[0];
  const content = document.getElementById('main-content');
  
  // Close mobile menu
  navLinks.classList.remove('open');
  content.innerHTML = '<div class="empty-state"><div class="spinner"></div><h2>Loading...</h2></div>';

  switch (route) {
    case 'home': renderHome(content); break;
    case 'login': renderLogin(content); break;
    case 'register': renderRegister(content); break;
    case 'change-password': renderChangePassword(content); break;
    case 'payment': renderPayment(content); break;
    case 'department': renderDepartment(content, parts[1]); break;
    case 'subject': renderSubject(content, parts[1], parts[2]); break;
    case 'previous': renderPreviousYears(content, parts[1], parts[2]); break;
    case 'mode': renderModeSelection(content, parts[1], parts[2], parts[3], parts[4]); break;
    case 'practice': renderPractice(content, parts[1], parts[2], parts[3], parts[4], parts[5]); break;
    case 'results': renderResults(content); break;
    case 'progress': renderProgress(content); break;
    case 'profile': renderProfile(content); break;
    case 'bookmarks': renderBookmarks(content); break;
    default: renderHome(content); break;
  }
}

window.addEventListener('load', handleRoute);
window.addEventListener('hashchange', handleRoute);

// Views

function renderProfile(container) {
  if (!state.user) return window.location.hash = '#login';

  const isPremium = state.user.is_paid === 1;
  const statusHtml = isPremium 
    ? `<span class="badge" style="background: var(--eth-green); color: white; padding: 5px 10px; border-radius: 20px;">Premium User</span>`
    : `<span class="badge" style="background: var(--accent); color: white; padding: 5px 10px; border-radius: 20px;">Free Trial (${state.user.free_questions_used} / 10 used)</span>`;

  container.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">My Profile</h2>
    </div>
    <div class="grid grid-2" style="margin-top: 20px; align-items: start;">
      <div class="glass-card">
        <h3 style="margin-bottom: 20px; color: var(--eth-yellow);"><i class="fas fa-user"></i> Account Details</h3>
        <p style="margin-bottom: 15px;"><strong>Username:</strong> ${state.user.username}</p>
        <p style="margin-bottom: 15px;"><strong>Status:</strong> ${statusHtml}</p>
        ${!isPremium ? `<p style="font-size: 0.9rem; color: var(--text-muted);">Upgrade to Premium for unlimited questions and full access to Mock Exams.</p>
        <a href="#payment" class="btn btn-primary" style="margin-top: 15px; display: inline-block;">Upgrade Now</a>` : ''}
      </div>

      <div class="glass-card">
        <h3 style="margin-bottom: 20px; color: var(--eth-yellow);"><i class="fas fa-lock"></i> Change Password</h3>
        <form id="profile-change-password-form">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <input type="password" id="prof-old-password" class="form-input" required>
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" id="prof-new-password" class="form-input" required minlength="4">
          </div>
          <button type="submit" class="btn btn-secondary" style="width: 100%;">Update Password</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('profile-change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = 'Updating...';
    
    try {
      const oldPassword = document.getElementById('prof-old-password').value;
      const newPassword = document.getElementById('prof-new-password').value;
      await apiCall('/user/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      
      showToast('Password updated successfully!', 'success');
      e.target.reset();
    } catch (err) {
      showToast(err.data?.error || 'Failed to update password', 'error');
    } finally {
      btn.textContent = 'Update Password';
    }
  });
}

function renderChangePassword(container) {
  if (!state.user) return window.location.hash = '#login';
  
  const isForced = state.user.must_change_password === 1;
  container.innerHTML = `
    <div class="glass-card" style="max-width: 400px; margin: 0 auto; margin-top: 40px;">
      <h2 style="text-align:center; margin-bottom: 20px;">${isForced ? 'Change Password Required' : 'Change Password'}</h2>
      ${isForced ? '<p style="text-align:center; margin-bottom: 20px; color: var(--accent);">Your password was reset by an admin. You must choose a new password before continuing.</p>' : ''}
      <form id="change-password-form">
        ${!isForced ? `
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input type="password" id="old-password" class="form-input" required>
        </div>` : ''}
        <div class="form-group">
          <label class="form-label">New Password</label>
          <input type="password" id="new-password" class="form-input" required minlength="4">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Change Password</button>
      </form>
    </div>
  `;
  
  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Updating...';
    
    try {
      const oldPassword = document.getElementById('old-password') ? document.getElementById('old-password').value : undefined;
      const newPassword = document.getElementById('new-password').value;
      await apiCall('/user/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      
      state.user.must_change_password = 0;
      saveUser(state.token, state.user);
      showToast('Password updated successfully!', 'success');
      window.location.hash = '#home';
    } catch (err) {
      showToast(err.data?.error || 'Failed to update password', 'error');
      btn.disabled = false;
      btn.textContent = 'Change Password';
    }
  });
}

async function renderHome(container) {
  if (!state.user) {
    // Logged out Educational Landing Page
    container.innerHTML = `
      <section class="hero" style="text-align: center; padding: 60px 20px;">
        <div class="hero-badge">🎓 The #1 Platform for Ethiopian Exit Exam Preparation</div>
        <h1 class="hero-title" style="margin-bottom: 20px;">Master Your Exit Exam with Confidence</h1>
        <p class="hero-subtitle" style="max-width: 700px; margin: 0 auto 30px;">After 4 to 7 years of intense university study, passing the Exit Exam is your final hurdle. Strategy, careful studying, and mastering your timing are key. Exit Prep Ethiopia provides the exact questions and answers you need.</p>
        <div>
          <a href="#login" class="btn btn-outline" style="margin-right: 15px;">Login</a>
          <a href="#register" class="btn btn-primary">Sign Up for Free Trial</a>
        </div>
      </section>
      
      <section style="padding: 40px 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; max-width: 1200px; margin: 0 auto;">
        <div class="glass-card" style="padding: 30px;">
          <h3 style="color: var(--eth-green); margin-bottom: 15px;">📚 Study Smart, Not Just Hard</h3>
          <p style="color: var(--text-secondary); line-height: 1.6;">Reviewing your entire degree can be overwhelming. Focus your energy by practicing with real previous exam questions and highly accurate mock exams designed to identify your weak spots.</p>
        </div>
        <div class="glass-card" style="padding: 30px;">
          <h3 style="color: var(--eth-yellow); margin-bottom: 15px;">⏱️ Master Your Timing</h3>
          <p style="color: var(--text-secondary); line-height: 1.6;">Many students fail not because they lack knowledge, but because they run out of time. Our platform simulates the real exam environment to help you pace yourself perfectly.</p>
        </div>
        <div class="glass-card" style="padding: 30px;">
          <h3 style="color: var(--primary); margin-bottom: 15px;">✅ Instant Feedback & Explanations</h3>
          <p style="color: var(--text-secondary); line-height: 1.6;">Don't just guess. Learn the 'why' behind every correct answer with our detailed explanations, ensuring you never make the same mistake twice on exam day.</p>
        </div>
      </section>
    `;
    return;
  }

  // Logged in Departments Grid
  try {
    const data = await apiCall('/departments');
    state.departments = data.departments;
    
    let html = `
      <section class="hero">
        <h1 class="hero-title">Welcome back, ${state.user.username}!</h1>
        <p class="hero-subtitle">Select your department below to continue your practice session.</p>
      </section>
      
      <div class="section-header">
        <h2 class="section-title">Your Departments</h2>
        <p class="section-subtitle">Choose your department to find relevant practice questions</p>
      </div>
      <div class="grid grid-3">
    `;
    
    state.departments.forEach(dept => {
      html += `
        <div class="dept-card" onclick="window.location.hash='#department/${dept.id}'">
          <div class="dept-icon">${dept.icon}</div>
          <h3 class="dept-name">${dept.name}</h3>
          <span class="dept-count">${dept.subjects.length} Subjects</span>
          <span class="dept-arrow">➔</span>
        </div>
      `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h2>Failed to load departments</h2><button class="btn btn-primary" onclick="handleRoute()">Retry</button></div>`;
  }
}

function renderLogin(container) {
  container.innerHTML = `
    <div class="glass-card" style="max-width: 400px; margin: 0 auto; margin-top: 40px;">
      <h2 style="text-align:center; margin-bottom: 20px;">Welcome Back</h2>
      <form id="login-form">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" id="login-username" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" id="login-password" class="form-input" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
      </form>
      <p style="text-align:center; margin-top: 20px; font-size: 0.9rem; color: var(--text-secondary);">
        Don't have an account? <a href="#register">Sign Up</a>
      </p>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    
    try {
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      
      saveUser(data.token, data.user);
      showToast('Logged in successfully', 'success');
      
      if (data.user.must_change_password) {
        window.location.hash = '#change-password';
      } else {
        window.location.hash = '#home';
      }
    } catch (err) {
      showToast(err.data?.error || 'Login failed', 'error');
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  });
}

function renderRegister(container) {
  container.innerHTML = `
    <div class="glass-card" style="max-width: 400px; margin: 0 auto; margin-top: 40px;">
      <h2 style="text-align:center; margin-bottom: 20px;">Create Account</h2>
      <form id="register-form">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" id="reg-username" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" id="reg-password" class="form-input" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Register</button>
      </form>
      <p style="text-align:center; margin-top: 20px; font-size: 0.9rem; color: var(--text-secondary);">
        Already have an account? <a href="#login">Login</a>
      </p>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Registering...';
    
    try {
      const username = document.getElementById('reg-username').value;
      const password = document.getElementById('reg-password').value;
      
      const data = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      
      saveUser(data.token, data.user);
      showToast('Account created successfully', 'success');
      window.location.hash = '#payment';
    } catch (err) {
      showToast(err.data?.error || 'Registration failed', 'error');
      btn.disabled = false;
      btn.textContent = 'Register';
    }
  });
}

async function renderPayment(container) {
  if (!state.user) {
    window.location.hash = '#login';
    return;
  }
  
  try {
    const data = await apiCall('/user/me');
    const user = data.user;
    saveUser(state.token, user);
    
    if (user.is_paid) {
      container.innerHTML = `
        <div class="glass-card" style="max-width: 600px; margin: 40px auto; text-align: center;">
          <h2 style="color: var(--primary);">Premium Activated! 🎉</h2>
          <p style="margin: 20px 0; color: var(--text-secondary);">You have full access to all mock exams and practice questions.</p>
          <a href="#home" class="btn btn-primary">Start Practicing</a>
        </div>
      `;
      return;
    }
    
    if (user.transaction_id) {
      container.innerHTML = `
        <div class="glass-card" style="max-width: 600px; margin: 40px auto; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 15px;">⏳</div>
          <h2 style="color: var(--secondary); margin-bottom: 15px;">Approval Under Review</h2>
          <p style="margin-bottom: 10px; color: var(--text-secondary);">We received your payment details and are currently reviewing them.</p>
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 15px; margin: 20px 0; text-align: left;">
            <p style="margin-bottom: 8px;"><strong style="color: var(--text-muted);">Name:</strong> <span style="color: var(--text-primary);">${user.full_name || 'N/A'}</span></p>
            <p><strong style="color: var(--text-muted);">Transaction ID:</strong> <span style="color: var(--secondary); font-family: monospace;">${user.transaction_id}</span></p>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">This usually takes a few minutes. Please check back shortly!</p>
          <button class="btn btn-outline" onclick="window.location.reload()">🔄 Refresh Status</button>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="glass-card" style="max-width: 600px; margin: 40px auto;">
        <h2 style="text-align:center; color: var(--eth-yellow); margin-bottom: 10px;">Upgrade to Premium</h2>
        <p style="text-align:center; color: var(--text-muted); margin-bottom: 25px;">
          Get unlimited mock exams, track your progress over time, and unlock all subjects.
        </p>

        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 20px; border-radius: var(--radius-md); margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="color: var(--eth-green); margin-bottom: 5px;">Start Your Free Trial</h3>
            <p style="font-size: 0.9rem; color: var(--text-muted);">Try 10 practice questions completely for free before deciding.</p>
          </div>
          <a href="#home" class="btn btn-outline" style="white-space: nowrap; margin-left: 15px;">Start Free Trial</a>
        </div>
        
        <div class="grid grid-2" style="margin-bottom: 25px;">
          <div style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 10px;">📱</div>
            <div style="font-weight: bold;">Telebirr</div>
            <div style="color: var(--eth-green); font-family: monospace; font-size: 1.1rem; margin-top: 5px;">0910507548</div>
          </div>
          <div style="background: var(--bg-card); padding: 15px; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 10px;">🏦</div>
            <div style="font-weight: bold;">CBE</div>
            <div style="color: var(--eth-green); font-family: monospace; font-size: 1.1rem; margin-top: 5px;">1000310040065</div>
          </div>
        </div>
        
        <form id="payment-form">
          <div class="form-group" style="margin-bottom: 15px;">
            <label class="form-label">Your Full Name *</label>
            <input type="text" id="pay-name" class="form-input" placeholder="e.g. Abebe Kebede" required>
          </div>
          <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">Transaction ID / Reference Number *</label>
            <input type="text" id="tx-id" class="form-input" placeholder="e.g. FT231948574" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">Submit for Approval</button>
        </form>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="#home" style="color: var(--text-muted); text-decoration: none; font-size: 0.9rem;">I'll pay later, take me to Home</a>
        </div>
      </div>
    `;
    
    document.getElementById('payment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Submitting...';
      
      try {
        const fullName = document.getElementById('pay-name').value.trim();
        const transactionId = document.getElementById('tx-id').value.trim();
        await apiCall('/user/payment', {
          method: 'POST',
          body: JSON.stringify({ transactionId, fullName })
        });
        showToast('Payment submitted! Awaiting approval.', 'success');
        renderPayment(container);
      } catch (err) {
        showToast(err.data?.error || 'Failed to submit', 'error');
        btn.disabled = false;
        btn.textContent = 'Submit for Approval';
      }
    });
    
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h2>Error loading payment details</h2></div>`;
  }
}

function renderDepartment(container, deptId) {
  const dept = state.departments.find(d => d.id === deptId);
  if (!dept) {
    window.location.hash = '#home';
    return;
  }
  
  let html = `
    <div class="breadcrumb">
      <span class="breadcrumb-link" onclick="window.location.hash='#home'">Home</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">${dept.name}</span>
    </div>
    
    <div class="section-header">
      <h2 class="section-title">${dept.name} Subjects</h2>
      <p class="section-subtitle">Select a subject to start practicing</p>
    </div>
    <div class="grid grid-3">
  `;
  
  dept.subjects.forEach(subject => {
    html += `
      <div class="subject-card" onclick="window.location.hash='#subject/${deptId}/${subject.id}'">
        <div class="subject-info">
          <div class="subject-icon">${subject.icon || '📚'}</div>
          <div>
            <div class="subject-name">${subject.name}</div>
          </div>
        </div>
        <div class="subject-actions">➔</div>
      </div>
    `;
  });
  
  html += `</div>`;
  container.innerHTML = html;
}

function renderSubject(container, deptId, subjectId) {
  const dept = state.departments.find(d => d.id === deptId);
  const subject = dept?.subjects.find(s => s.id === subjectId);
  if (!subject) return window.location.hash = '#home';
  
  const isPaid = state.user?.is_paid;

  container.innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-link" onclick="window.location.hash='#home'">Home</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-link" onclick="window.location.hash='#department/${deptId}'">${dept.name}</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">${subject.name}</span>
    </div>
    
    <div class="section-header">
      <h2 class="section-title">Choose Practice Type</h2>
    </div>
    
    <div class="grid grid-3">
      <div class="category-card ${!isPaid ? 'locked' : ''}" onclick="window.location.hash = ${isPaid ? `'#mode/${deptId}/${subjectId}/mock'` : `'#payment'`}">
        ${!isPaid ? '<div class="locked-badge">🔒 Premium Only</div>' : ''}
        <div class="mode-icon">📝</div>
        <h3>Mock Exam</h3>
        <p class="mode-desc">Full simulated exit exam with random questions.</p>
      </div>
      
      <div class="category-card" onclick="window.location.hash='#previous/${deptId}/${subjectId}'">
        <div class="mode-icon">📚</div>
        <h3>Previous Exit Exams</h3>
        <p class="mode-desc">Practice questions from previous years.</p>
      </div>
      
      <div class="category-card" onclick="window.location.hash='#mode/${deptId}/${subjectId}/mcq'">
        <div class="mode-icon">🔢</div>
        <h3>General MCQ</h3>
        <p class="mode-desc">Practice topic-by-topic multiple choice questions.</p>
      </div>
    </div>
  `;
}

async function renderPreviousYears(container, deptId, subjectId) {
  try {
    const data = await apiCall(`/questions?subjectId=${subjectId}&type=previous`);
    const questions = data.questions || [];
    
    // Extract unique years
    const years = [...new Set(questions.filter(q => q.year).map(q => q.year))].sort((a,b)=>b-a);
    
    if (years.length === 0) {
      container.innerHTML = `
        <div class="breadcrumb">
          <span class="breadcrumb-link" onclick="window.location.hash='#subject/${deptId}/${subjectId}'">Back</span>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h3>No previous exams found</h3>
          <p>We don't have previous exam questions for this subject yet.</p>
        </div>
      `;
      return;
    }
    
    let html = `
      <div class="breadcrumb">
        <span class="breadcrumb-link" onclick="window.location.hash='#subject/${deptId}/${subjectId}'">Back</span>
      </div>
      <div class="section-header"><h2 class="section-title">Select Year</h2></div>
      <div class="grid grid-4">
    `;
    
    years.forEach(year => {
      html += `
        <div class="year-card" onclick="window.location.hash='#mode/${deptId}/${subjectId}/previous/${year}'">
          ${year}
        </div>
      `;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    if (err.status === 403) {
      window.location.hash = '#payment';
    } else {
      container.innerHTML = `<div class="empty-state"><h2>Error loading years</h2></div>`;
    }
  }
}

function renderModeSelection(container, deptId, subjectId, type, year) {
  const urlBase = `#practice/${deptId}/${subjectId}/${type}${year ? '/' + year : '/none'}`;
  
  container.innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-link" onclick="window.history.back()">Back</span>
    </div>
    <div class="section-header">
      <h2 class="section-title">Select Answer Mode</h2>
    </div>
    
    <div class="grid grid-2">
      <div class="answer-mode-card" onclick="window.location.hash='${urlBase}/instant'">
        <div class="mode-icon">📖</div>
        <h3>Instant Feedback</h3>
        <p class="mode-desc">See the correct answer and explanation immediately after each question. Great for learning.</p>
      </div>
      
      <div class="answer-mode-card" onclick="window.location.hash='${urlBase}/finish'">
        <div class="mode-icon">📋</div>
        <h3>Finish All First</h3>
        <p class="mode-desc">Answer all questions first, then review your results at the end. Simulates a real exam.</p>
      </div>
    </div>
  `;
}

async function renderPractice(container, deptId, subjectId, type, yearStr, mode) {
  try {
    let url = `/questions?subjectId=${subjectId}&type=${type}`;
    if (yearStr && yearStr !== 'none') {
      url += `&year=${yearStr}`;
    }
    
    const data = await apiCall(url);
    const questions = data.questions || [];
    
    if (type === 'mock') {
      questions.sort(() => Math.random() - 0.5);
    }
    
    if (questions.length === 0) {
      container.innerHTML = `<div class="empty-state"><h2>No questions found</h2><button class="btn btn-primary" onclick="window.history.back()">Back</button></div>`;
      return;
    }
    
    state.practice = {
      questions,
      currentIndex: 0,
      score: 0,
      mode,
      answers: new Array(questions.length).fill(null),
      hitPaywall: (questions.length === 10 && !state.user?.is_paid),
      startTime: Date.now(),
      type,
      subjectId,
      deptId,
      isChecking: false // for instant mode state
    };
    
    renderCurrentQuestion(container);
  } catch (err) {
    if (err.status === 403) window.location.hash = '#payment';
    else container.innerHTML = `<div class="empty-state"><h2>Error loading practice</h2></div>`;
  }
}

function renderCurrentQuestion(container) {
  const p = state.practice;
  if (p.currentIndex >= p.questions.length) {
    window.location.hash = '#results';
    return;
  }
  
  const q = p.questions[p.currentIndex];
  const progressPct = ((p.currentIndex) / p.questions.length) * 100;
  
  const bookmarks = getBookmarks();
  const isBookmarked = bookmarks.some(b => b.id === q.id);
  
  let optionsHtml = '';
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  q.options.forEach((opt, idx) => {
    let classes = 'option-btn';
    let isSelected = p.answers[p.currentIndex] === idx;
    
    if (isSelected) classes += ' selected';
    
    if (p.mode === 'instant' && p.isChecking) {
      classes += ' disabled';
      if (idx === q.correctAnswer) classes += ' correct';
      else if (isSelected) classes += ' incorrect';
    }
    
    optionsHtml += `
      <button class="${classes}" data-idx="${idx}" ${p.isChecking ? 'disabled' : ''}>
        <span class="option-label">${labels[idx]}</span>
        <span class="option-text">${opt}</span>
      </button>
    `;
  });
  
  container.innerHTML = `
    <div class="question-wrapper">
      <div class="practice-header">
        <div class="practice-header-left">
          <span class="badge ${p.type === 'mock' ? 'badge-warning' : 'badge-primary'}">${p.type.toUpperCase()}</span>
          <span style="color: var(--text-secondary); font-size: 0.95rem; margin-left: 12px; font-weight: 500;">Question ${p.currentIndex + 1} of ${p.questions.length}</span>
        </div>
        <div class="practice-header-right">
          <button class="btn btn-outline" style="padding: 6px 14px; font-size: 0.85rem;" id="btn-bookmark">
            ${isBookmarked ? '⭐ Bookmarked' : '☆ Bookmark'}
          </button>
          <button class="btn btn-outline" style="padding: 6px 14px; font-size: 0.85rem; border-color: var(--accent); color: var(--accent);" onclick="window.quitPractice()">
            Quit
          </button>
        </div>
      </div>
      
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
      </div>
      
      <div class="glass-card practice-card-responsive" style="margin-top: 30px; padding: 40px 30px; border-radius: 16px;">
        <div class="question-text">${q.question}</div>
        
        <div class="options-list" id="options-container" style="display: flex; flex-direction: column; gap: 12px;">
          ${optionsHtml}
        </div>
        
        ${(p.mode === 'instant' && p.isChecking) ? `
          <div class="explanation-box">
            <div class="explanation-title">💡 Explanation</div>
            <div class="explanation-text">${q.explanation || 'No explanation provided.'}</div>
          </div>
          <div class="mobile-full-width" style="margin-top: 30px; text-align: right;">
            <button class="btn btn-primary btn-lg" id="btn-next">Next Question ➔</button>
          </div>
        ` : `
          <div class="mobile-full-width" style="margin-top: 30px; text-align: right;">
            ${p.mode === 'instant' ? 
              `<button class="btn btn-primary btn-lg" id="btn-check" ${p.answers[p.currentIndex] === null ? 'disabled' : ''}>Check Answer</button>` :
              `<button class="btn btn-primary btn-lg" id="btn-next" ${p.answers[p.currentIndex] === null ? 'disabled' : ''}>${p.currentIndex === p.questions.length - 1 ? 'Finish Exam' : 'Next ➔'}</button>`
            }
          </div>
        `}
      </div>
    </div>
  `;
  
  // Attach event listeners
  const optionsContainer = document.getElementById('options-container');
  optionsContainer.addEventListener('click', (e) => {
    if (p.isChecking) return; // disabled
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    
    const idx = parseInt(btn.getAttribute('data-idx'));
    p.answers[p.currentIndex] = idx;
    
    // Re-render specifically the options to update selection
    Array.from(optionsContainer.children).forEach(child => child.classList.remove('selected'));
    btn.classList.add('selected');
    
    const actionBtn = document.getElementById(p.mode === 'instant' ? 'btn-check' : 'btn-next');
    if (actionBtn) actionBtn.disabled = false;
  });
  
  document.getElementById('btn-bookmark').addEventListener('click', (e) => {
    let b = getBookmarks();
    if (isBookmarked) {
      b = b.filter(x => x.id !== q.id);
      e.target.classList.remove('active');
      showToast('Removed from bookmarks');
    } else {
      b.push(q);
      e.target.classList.add('active');
      showToast('Added to bookmarks');
    }
    saveBookmarks(b);
  });
  
  if (document.getElementById('btn-check')) {
    document.getElementById('btn-check').addEventListener('click', () => {
      p.isChecking = true;
      if (p.answers[p.currentIndex] === q.correctAnswer) p.score++;
      renderCurrentQuestion(container); // Re-render to show feedback
    });
  }
  
  if (document.getElementById('btn-next')) {
    document.getElementById('btn-next').addEventListener('click', () => {
      if (p.mode === 'finish' && p.answers[p.currentIndex] === q.correctAnswer) {
        p.score++;
      }
      p.currentIndex++;
      p.isChecking = false;
      renderCurrentQuestion(container);
    });
  }
}

function renderResults(container) {
  const p = state.practice;
  if (!p.questions || p.questions.length === 0) return window.location.hash = '#home';
  
  // Calculate if mode was 'finish' and score wasn't calculated yet (it should be calculated during next, but just in case)
  let calculatedScore = 0;
  p.questions.forEach((q, idx) => {
    if (p.answers[idx] === q.correctAnswer) calculatedScore++;
  });
  p.score = calculatedScore;
  
  const pct = Math.round((p.score / p.questions.length) * 100);
  let grade = 'Needs Improvement';
  let color = 'var(--accent)';
  if (pct >= 85) { grade = 'Excellent'; color = 'var(--primary)'; }
  else if (pct >= 70) { grade = 'Good'; color = 'var(--eth-green)'; }
  else if (pct >= 50) { grade = 'Fair'; color = 'var(--secondary)'; }
  
  window.saveCurrentProgress = async function() {
    const prog = getProgress();
    if (!prog[p.subjectId]) prog[p.subjectId] = { totalAttempted: 0, totalCorrect: 0, examHistory: [] };
    prog[p.subjectId].totalAttempted += p.questions.length;
    prog[p.subjectId].totalCorrect += p.score;
    prog[p.subjectId].examHistory.push({
      date: new Date().toISOString(),
      score: p.score,
      total: p.questions.length,
      mode: p.mode,
      type: p.type
    });
    saveProgress(prog);
    
    // Track usage for free trial
    if (!state.user.is_paid) {
      await apiCall('/user/track-usage', {
        method: 'POST',
        body: JSON.stringify({ count: p.questions.length })
      }).catch(console.error);
      state.user.free_questions_used = (state.user.free_questions_used || 0) + p.questions.length;
      saveUser(state.token, state.user);
    }
    
    showToast('Progress saved successfully!', 'success');
    window.location.hash = '#home';
  };
  
  window.discardCurrentProgress = async function() {
    // Still track usage even if discarded to prevent abuse
    if (!state.user.is_paid) {
      await apiCall('/user/track-usage', {
        method: 'POST',
        body: JSON.stringify({ count: p.questions.length })
      }).catch(console.error);
      state.user.free_questions_used = (state.user.free_questions_used || 0) + p.questions.length;
      saveUser(state.token, state.user);
    }
    showToast('Progress discarded.', 'info');
    window.location.hash = '#home';
  };
  
  window.quitPractice = async function() {
    if (!state.user.is_paid && state.practice.currentIndex > 0) {
      await apiCall('/user/track-usage', {
        method: 'POST',
        body: JSON.stringify({ count: state.practice.currentIndex })
      }).catch(console.error);
      state.user.free_questions_used = (state.user.free_questions_used || 0) + state.practice.currentIndex;
      saveUser(state.token, state.user);
    }
    window.location.hash = '#home';
  };
  
  let html = `
    <div class="results-wrapper">
      <h2 style="font-size: 2rem;">Practice Completed!</h2>
      
      <div class="score-circle" style="--score-pct: ${pct}%; --score-color: ${color}">
        <span class="score-value" style="color: ${color}">${pct}%</span>
        <span class="score-label">SCORE</span>
      </div>
      
      <div class="results-grade" style="color: ${color}">${grade}</div>
      <p class="results-message">You got ${p.score} out of ${p.questions.length} questions correct.</p>
      
      ${p.hitPaywall ? `
        <div class="paywall-banner">
          <h3>Unlock More Questions!</h3>
          <p>You've reached the free trial limit. Upgrade to Premium to access all past exit exams and unlimited mock exams.</p>
          <a href="#payment" class="btn btn-primary" style="margin-top: 15px;">Upgrade Now</a>
        </div>
      ` : ''}
      
      <div class="btn-group" style="justify-content: center; margin-bottom: 40px;">
        <button class="btn btn-primary" onclick="window.saveCurrentProgress()">Save Progress</button>
        <button class="btn btn-outline" onclick="window.discardCurrentProgress()">Discard & Exit</button>
      </div>
    </div>
    
    <div class="section-header">
      <h3 class="section-title">Answer Review</h3>
    </div>
  `;
  
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  p.questions.forEach((q, idx) => {
    const isCorrect = p.answers[idx] === q.correctAnswer;
    const userAns = p.answers[idx] !== null ? labels[p.answers[idx]] : 'None';
    const correctAns = labels[q.correctAnswer];
    
    html += `
      <div class="glass-card" style="margin-bottom: 20px; border-color: ${isCorrect ? 'var(--eth-green)' : 'var(--accent)'}">
        <div style="font-weight:bold; margin-bottom: 10px;">Q${idx+1}: ${q.question}</div>
        <div class="grid grid-2" style="font-size: 0.9rem; margin-bottom: 10px;">
          <div style="color: ${isCorrect ? 'var(--eth-green)' : 'var(--accent)'}">Your Answer: ${userAns}</div>
          <div style="color: var(--eth-green)">Correct Answer: ${correctAns}</div>
        </div>
        <div class="explanation-box" style="margin-top:0;">
          <div class="explanation-text">${q.explanation || 'No explanation provided.'}</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function renderProgress(container) {
  if (!state.user) return window.location.hash = '#login';
  
  const prog = getProgress();
  let totalQs = 0;
  let totalCorrect = 0;
  let sessions = 0;
  let subjectsCount = Object.keys(prog).length;
  
  Object.values(prog).forEach(s => {
    totalQs += s.totalAttempted;
    totalCorrect += s.totalCorrect;
    sessions += s.examHistory.length;
  });
  
  const overallAcc = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
  
  let html = `
    <div class="section-header">
      <h2 class="section-title">Your Progress Dashboard</h2>
    </div>
    
    <div class="progress-overview">
      <div class="progress-card">
        <span class="progress-card-value blue">${totalQs}</span>
        <span class="progress-card-label">Questions Attempted</span>
      </div>
      <div class="progress-card">
        <span class="progress-card-value green">${overallAcc}%</span>
        <span class="progress-card-label">Overall Accuracy</span>
      </div>
      <div class="progress-card">
        <span class="progress-card-value yellow">${sessions}</span>
        <span class="progress-card-label">Sessions Completed</span>
      </div>
      <div class="progress-card">
        <span class="progress-card-value">${subjectsCount}</span>
        <span class="progress-card-label">Subjects Practiced</span>
      </div>
    </div>
    
    <h3 class="section-title" style="margin-bottom: 20px;">Subject Breakdown</h3>
  `;
  
  if (subjectsCount === 0) {
    html += `<div class="empty-state"><p>You haven't practiced any subjects yet.</p></div>`;
  } else {
    html += `<div class="grid grid-2">`;
    Object.entries(prog).forEach(([subjectId, stats]) => {
      // Find subject name from cached departments
      let subjectName = `Subject ${subjectId}`;
      for (let d of state.departments) {
        let s = d.subjects.find(sub => sub.id == subjectId);
        if (s) { subjectName = s.name; break; }
      }
      
      const acc = stats.totalAttempted > 0 ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100) : 0;
      
      html += `
        <div class="glass-card">
          <h4>${subjectName}</h4>
          <div style="display:flex; justify-content:space-between; margin-top: 10px; font-size:0.8rem; color:var(--text-secondary);">
            <span>Accuracy: ${acc}%</span>
            <span>Attempted: ${stats.totalAttempted}</span>
          </div>
          <div class="progress-bar" style="width:100%; margin-top:5px; height:8px;">
            <div class="progress-fill" style="width: ${acc}%; background: var(--primary);"></div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }
  
  container.innerHTML = html;
}

function renderBookmarks(container) {
  if (!state.user) return window.location.hash = '#login';
  
  const bookmarks = getBookmarks();
  
  let html = `
    <div class="section-header">
      <h2 class="section-title">Bookmarked Questions</h2>
      <p class="section-subtitle">Review questions you've saved</p>
    </div>
  `;
  
  if (bookmarks.length === 0) {
    html += `<div class="empty-state"><h2>No bookmarks yet</h2><p>Bookmark difficult questions while practicing to review them here.</p></div>`;
    container.innerHTML = html;
    return;
  }
  
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  bookmarks.forEach((q, idx) => {
    html += `
      <div class="glass-card" style="margin-bottom: 20px; position:relative;" id="bookmark-${q.id}">
        <button class="btn-icon" style="position:absolute; top:20px; right:20px; background:rgba(239, 68, 68, 0.1); color:var(--accent); border:none;" onclick="removeBookmark('${q.id}')">❌</button>
        <div style="font-weight:bold; margin-bottom: 15px; padding-right: 40px;">${q.question}</div>
        <div style="color: var(--eth-green); margin-bottom: 10px; font-size: 0.9rem;">
          Correct Answer: <strong>${labels[q.correctAnswer]} - ${q.options[q.correctAnswer]}</strong>
        </div>
        <div class="explanation-box" style="margin-top:0;">
          <div class="explanation-text">${q.explanation || 'No explanation provided.'}</div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

window.removeBookmark = function(id) {
  let b = getBookmarks();
  b = b.filter(q => q.id !== parseInt(id) && q.id !== id);
  saveBookmarks(b);
  const el = document.getElementById(`bookmark-${id}`);
  if (el) el.remove();
  showToast('Bookmark removed');
  if (b.length === 0) renderBookmarks(document.getElementById('main-content'));
};

// Initialize app
updateNav();
handleRoute();
