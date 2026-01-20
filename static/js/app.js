// API Configuration
// VERSION: v4.0-HOLDING-AREA-COLOR-FLAGS - FIXED VERSION
// Last Updated: 2026-01-19
// Features: All bugs fixed - ready to use
const API_URL = window.location.origin + '/api';
let currentUser = null;
let authToken = null;

// Utility Functions
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
    authToken = token;
}

function clearToken() {
    localStorage.removeItem('token');
    authToken = null;
}

function getUser() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
}

function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
    currentUser = user;
}

async function apiCall(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });
        
        // Only redirect on 401 if NOT login endpoint (login endpoint handles 401 as invalid credentials)
        if (response.status === 401 && endpoint !== '/login') {
            clearToken();
            window.location.href = '/';
            return null;
        }
        
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error('Invalid response from server');
        }
        
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getStatusBadgeClass(status) {
    const classes = {
        'green': 'badge-success',
        'amber': 'badge-warning',
        'red': 'badge-danger'
    };
    return classes[status] || 'badge-success';
}

function getStatusEmoji(status) {
    const emojis = {
        'green': '🟢',
        'amber': '🟡',
        'red': '🔴'
    };
    return emojis[status] || '🟢';
}

function getStatusName(status) {
    const names = {
        'green': 'Normal',
        'amber': 'Warning',
        'red': 'Overdue'
    };
    return names[status] || 'Normal';
}

function calculateStatusFromHours(hours) {
    "Calculate status based on hours parked"
    if (hours < 4) {
        return 'green';
    } else if (hours < 12) {
        return 'amber';
    } else {
        return 'red';
    }
}

function getStatusDisplay(status) {
    const emoji = getStatusEmoji(status);
    const name = getStatusName(status);
    return `${emoji} ${name}`;
}

function calculateHoursParked(firstScan, lastScan) {
    const diff = new Date() - new Date(firstScan);
    return (diff / (1000 * 60 * 60)).toFixed(1);
}

function calculateTimeDifference(firstScan, lastScan) {
    const diff = new Date(lastScan) - new Date(firstScan);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

// Login Page
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorDiv = document.getElementById('loginError');
        
        if (!usernameInput || !passwordInput) {
            console.error('Login form elements not found');
            alert('Login form error - please refresh the page');
            return;
        }
        
        const username = usernameInput.value;
        const password = passwordInput.value;
        
        if (!username || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Please enter username and password';
                errorDiv.style.display = 'block';
            } else {
                alert('Please enter username and password');
            }
            return;
        }
        
        try {
            const data = await apiCall('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            console.log('Login response:', data);
            
            if (!data) {
                throw new Error('No response from server');
            }
            
            if (data.token && data.user) {
                setToken(data.token);
                setUser(data.user);
                window.location.href = '/dashboard';
            } else {
                console.error('Missing token or user in response:', data);
                throw new Error(data.error || 'Login failed - please try again');
            }
        } catch (error) {
            console.error('Login error:', error);
            if (errorDiv) {
                errorDiv.textContent = error.message || 'Login failed';
                errorDiv.style.display = 'block';
            } else {
                alert('Login failed: ' + (error.message || 'Unknown error'));
            }
        }
    });
}

// Dashboard Page
if (document.getElementById('dashboardContent')) {
    const user = getUser();
    
    if (!user) {
        window.location.href = '/';
    } else {
        currentUser = user;
        initDashboard();
    }
}

function initDashboard() {
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userRole').textContent = currentUser.role;
    
    const navbarBrand = document.querySelector('.navbar-brand span:last-child');
    if (navbarBrand) {
        if (currentUser.role === 'admin') {
            navbarBrand.textContent = 'Admin Dashboard';
        } else if (currentUser.role === 'supervisor') {
            navbarBrand.textContent = 'Supervisor Dashboard';
        } else {
            navbarBrand.textContent = 'Worker Dashboard';
        }
    }
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        clearToken();
        localStorage.removeItem('user');
        window.location.href = '/';
    });
    
    if (currentUser.role === 'worker') {
        loadWorkerDashboard();
    } else if (currentUser.role === 'supervisor') {
        loadSupervisorDashboard();
    } else if (currentUser.role === 'admin') {
        loadAdminDashboard();
    }
}

function loadWorkerDashboard() {
    showScannerSection();
    loadDashboardData();
    loadHoldingCars();
    loadParkedCars();
    document.getElementById('userManagementSection')?.remove();
    document.getElementById('navbarSearch').style.display = 'none';
    
    // Auto-refresh data every 60 seconds to update times and status
    setInterval(() => {
        loadHoldingCars();
        loadParkedCars();
        loadDashboardData();
    }, 60000);
}

function loadSupervisorDashboard() {
    document.getElementById('navbarSearch').style.display = 'flex';
    document.getElementById('globalSearch').placeholder = '🔍 Search your team workers...';
    
    loadDashboardData();
    loadCars();
    showSupervisorDashboard();
    document.getElementById('userManagementSection')?.remove();
    
    // Auto-refresh data every 60 seconds to update times and status
    setInterval(() => {
        loadCars();
        loadAdminHoldingCars();
        loadDashboardData();
    }, 60000);
}

function loadAdminDashboard() {
    document.getElementById('navbarSearch').style.display = 'none';
    createUnifiedAdminDashboard();
    
    // Auto-refresh data every 60 seconds to update times and status
    setInterval(() => {
        loadUsers();
        loadAdminHoldingCars();
        loadCars();
        loadDashboardData();
    }, 60000);
}

function createUnifiedAdminDashboard() {
    const mainContent = document.querySelector('.main-content');
    
    if (!mainContent) return;
    
    mainContent.innerHTML = `
        <!-- Stats Cards -->
        <div class="stats-grid" style="margin-bottom: 24px;">
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon primary">📊</div>
                </div>
                <div class="stat-value" id="totalCars">0</div>
                <div class="stat-label">Total Cars Today</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon success">🟢</div>
                </div>
                <div class="stat-value" id="activeCars">0</div>
                <div class="stat-label">Normal (< 4 hours)</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon warning">🟡</div>
                </div>
                <div class="stat-value" id="warningCars">0</div>
                <div class="stat-label">Warning (4-12 hours)</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon danger">🔴</div>
                </div>
                <div class="stat-value" id="overdueCars">0</div>
                <div class="stat-label">Overdue (12+ hours)</div>
            </div>
        </div>
        
        <!-- Unified User Management -->
        <div class="card" style="margin-bottom: 24px;">
            <div class="card-header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <h2 class="card-title" style="color: white;">👥 User Management</h2>
                <div class="card-actions">
                    <button onclick="showAddUserModal()" class="btn-add-user">
                        <span style="font-size: 18px;">➕</span>
                        <span>Add User</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="admin-filter-bar">
                    <div class="role-filter-buttons">
                        <button onclick="filterUsersByRole('')" id="filterAll" class="role-btn active">
                            👥 All
                        </button>
                        <button onclick="filterUsersByRole('worker')" id="filterWorker" class="role-btn">
                            👷 Workers
                        </button>
                        <button onclick="filterUsersByRole('supervisor')" id="filterSupervisor" class="role-btn">
                            👨‍💼 Supervisors
                        </button>
                        <button onclick="filterUsersByRole('admin')" id="filterAdmin" class="role-btn">
                            👑 Admins
                        </button>
                    </div>
                    
                    <div class="search-and-count">
                        <input type="text" id="userSearchInput" placeholder="🔍 Search by name or username..." 
                               onkeyup="searchUsersInTable()" class="user-search-input">
                        <div class="user-count" id="userCount">Loading...</div>
                    </div>
                </div>
                
                <div class="unified-table-container">
                    <table class="unified-user-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Shift</th>
                                <th>Supervisor</th>
                                <th>Status</th>
                                <th>Excel</th>
                                <th>Delete</th>
                            </tr>
                        </thead>
                        <tbody id="unifiedUserTable">
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">
                                    Loading users...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- Holding Area Vehicles Table -->
        <div class="card" style="margin-bottom: 32px;">
            <div class="card-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                <h2 class="card-title" style="color: white;">📦 Holding Area Vehicles</h2>
                <div class="card-actions">
                    <button onclick="exportHoldingExcel()" class="btn-download-excel" style="background: white; color: #d97706;">
                        <span style="font-size: 20px;">📥</span>
                        <span>Download Excel</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="filter-bar">
                    <input type="date" id="holdingDateFilter" class="filter-select">
                    <select id="holdingShiftFilter" class="filter-select" onchange="loadAdminHoldingCars()">
                        <option value="">All Shifts</option>
                        <option value="1">Day Shift (6AM-6PM)</option>
                        <option value="2">Night Shift (6PM-6AM)</option>
                    </select>
                </div>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>CAR ID</th>
                                <th>VESSEL</th>
                                <th>AREA</th>
                                <th>UNIT</th>
                                <th>WORKER</th>
                                <th>TIME</th>
                                <th>HOURS</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody id="holdingCarsTableBody">
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">No vehicles in holding area</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- Parked Vehicles Table -->
        <div class="card" style="margin-bottom: 32px;">
            <div class="card-header" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                <h2 class="card-title" style="color: white;">🚗 Parked Vehicles</h2>
                <div class="card-actions">
                    <button onclick="exportExcel()" class="btn-download-excel" style="background: white; color: #8b5cf6;">
                        <span style="font-size: 20px;">📥</span>
                        <span>Download Excel</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="filter-bar">
                    <input type="date" id="dateFilter" class="filter-select">
                    <select id="shiftFilter" class="filter-select" onchange="loadCars()">
                        <option value="">All Shifts</option>
                        <option value="1">Day Shift (6AM-6PM)</option>
                        <option value="2">Night Shift (6PM-6AM)</option>
                    </select>
                    <select id="statusFilter" class="filter-select" onchange="loadCars()">
                        <option value="">All Status</option>
                        <option value="green">🟢 Normal</option>
                        <option value="amber">🟡 Warning</option>
                        <option value="red">🔴 Overdue</option>
                    </select>
                </div>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>CAR ID</th>
                                <th>FIRST SCAN</th>
                                <th>LAST SCAN</th>
                                <th>TIME DIFF</th>
                                <th>SCANS</th>
                                <th>HOURS</th>
                                <th>STATUS</th>
                                <th>WORKER</th>
                            </tr>
                        </thead>
                        <tbody id="parkedCarsTableBody">
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">Loading...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div id="userManagementSection"></div>
    `;
    
    document.getElementById('holdingDateFilter').value = new Date().toISOString().split('T')[0];
    document.getElementById('holdingDateFilter').addEventListener('change', loadAdminHoldingCars);
    
    document.getElementById('dateFilter').value = new Date().toISOString().split('T')[0];
    document.getElementById('dateFilter').addEventListener('change', loadCars);
    document.getElementById('shiftFilter').addEventListener('change', loadCars);
    document.getElementById('statusFilter').addEventListener('change', loadCars);
    
    loadDashboardData();
    loadAllUsersUnified();
    showUserManagement();
    loadAdminHoldingCars();
    loadCars();
}

let allUnifiedUsers = [];
let currentRoleFilter = '';

async function loadAllUsersUnified() {
    try {
        const users = await apiCall('/users');
        allUnifiedUsers = users;
        displayUnifiedUserTable(users);
    } catch (error) {
        console.error('Failed to load users:', error);
        document.getElementById('unifiedUserTable').innerHTML = 
            '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">Failed to load users</td></tr>';
    }
}

function displayUnifiedUserTable(users) {
    const tbody = document.getElementById('unifiedUserTable');
    const userCount = document.getElementById('userCount');
    
    if (!tbody) return;
    
    if (userCount) {
        userCount.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
    }
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <a href="#" onclick="showUserProfile(${user.user_id}, '${user.role}'); return false;" 
                   class="user-name-link">
                    ${user.username}
                </a>
            </td>
            <td>
                <span class="role-badge role-${user.role}">
                    ${user.role === 'admin' ? '👑' : user.role === 'supervisor' ? '👨‍💼' : '👷'} 
                    ${user.role}
                </span>
            </td>
            <td class="text-secondary">${user.assigned_shift ? `Shift ${user.assigned_shift}` : '-'}</td>
            <td class="text-secondary">${user.supervisor_name || '-'}</td>
            <td>
                <span class="status-badge status-${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? '✅ Active' : '❌ Inactive'}
                </span>
            </td>
            <td style="text-align: center;">
                ${user.role === 'worker' ? `
                    <button onclick="downloadWorkerExcel(${user.user_id}, '${user.username}')" 
                            class="btn-excel-table" title="Download Excel Report">
                        <span style="font-size: 16px;">📥</span>
                        <span>Excel</span>
                    </button>
                ` : '<span style="color: #cbd5e1; font-size: 12px;">-</span>'}
            </td>
            <td style="text-align: center;">
                <button onclick="deleteUser(${user.user_id}, '${user.username}')" 
                        class="btn-delete" title="Delete User">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
}

function filterUsersByRole(role) {
    currentRoleFilter = role;
    
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = role === '' ? document.getElementById('filterAll') :
                      role === 'worker' ? document.getElementById('filterWorker') :
                      role === 'supervisor' ? document.getElementById('filterSupervisor') :
                      document.getElementById('filterAdmin');
    
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    applyUserFilters();
}

function searchUsersInTable() {
    applyUserFilters();
}

function applyUserFilters() {
    const searchTerm = document.getElementById('userSearchInput')?.value.toLowerCase().trim() || '';
    
    let filtered = allUnifiedUsers;
    
    if (currentRoleFilter) {
        filtered = filtered.filter(u => u.role === currentRoleFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(u => 
            u.username.toLowerCase().includes(searchTerm)
        );
    }
    
    displayUnifiedUserTable(filtered);
}

async function deleteUser(userId, userName) {
    if (!confirm(`Are you sure you want to DELETE ${userName}?\n\nThis will deactivate their account.`)) {
        return;
    }
    
    try {
        await apiCall(`/users/${userId}`, {
            method: 'DELETE'
        });
        
        alert(`${userName} has been deleted successfully!`);
        await loadAllUsersUnified();
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete user: ' + error.message);
    }
}

function showSupervisorDashboard() {
    const dashboardHTML = `
        <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
                <h2 class="card-title">👥 My Team Workers</h2>
            </div>
            <div class="card-body">
                <div id="supervisorWorkersList"></div>
            </div>
        </div>
        
        <!-- Holding Area Vehicles Table -->
        <div class="card" style="margin-bottom: 32px;">
            <div class="card-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                <h2 class="card-title" style="color: white;">📦 Holding Area Vehicles</h2>
                <div class="card-actions">
                    <button onclick="exportHoldingExcel()" class="btn-download-excel" style="background: white; color: #d97706;">
                        <span style="font-size: 20px;">📥</span>
                        <span>Download Excel</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="filter-bar">
                    <input type="date" id="holdingDateFilter" class="filter-select">
                    <select id="holdingShiftFilter" class="filter-select" onchange="loadAdminHoldingCars()">
                        <option value="">All Shifts</option>
                        <option value="1">Day Shift (6AM-6PM)</option>
                        <option value="2">Night Shift (6PM-6AM)</option>
                    </select>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>CAR ID</th>
                                <th>VESSEL</th>
                                <th>AREA</th>
                                <th>UNIT</th>
                                <th>WORKER</th>
                                <th>TIME</th>
                                <th>HOURS</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody id="holdingCarsTableBody">
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">No vehicles in holding area</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- Parked Vehicles Table -->
        <div class="card" style="margin-bottom: 32px;">
            <div class="card-header" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                <h2 class="card-title" style="color: white;">🚗 Parked Vehicles</h2>
                <div class="card-actions">
                    <button onclick="exportExcel()" class="btn-download-excel" style="background: white; color: #8b5cf6;">
                        <span style="font-size: 20px;">📥</span>
                        <span>Download Excel</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="filter-bar">
                    <input type="date" id="dateFilter" class="filter-select">
                    <select id="shiftFilter" class="filter-select" onchange="loadCars()">
                        <option value="">All Shifts</option>
                        <option value="1">Day Shift (6AM-6PM)</option>
                        <option value="2">Night Shift (6PM-6AM)</option>
                    </select>
                    <select id="statusFilter" class="filter-select" onchange="loadCars()">
                        <option value="">All Status</option>
                        <option value="green">🟢 Normal</option>
                        <option value="amber">🟡 Warning</option>
                        <option value="red">🔴 Overdue</option>
                    </select>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>CAR ID</th>
                                <th>FIRST SCAN</th>
                                <th>LAST SCAN</th>
                                <th>TIME DIFF</th>
                                <th>SCANS</th>
                                <th>HOURS</th>
                                <th>STATUS</th>
                                <th>WORKER</th>
                            </tr>
                        </thead>
                        <tbody id="parkedCarsTableBody">
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">Loading...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    const mainContent = document.querySelector('.main-content');
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid && mainContent) {
        statsGrid.insertAdjacentHTML('afterend', dashboardHTML);
    }
    
    document.getElementById('holdingDateFilter').value = new Date().toISOString().split('T')[0];
    document.getElementById('holdingDateFilter').addEventListener('change', loadAdminHoldingCars);
    
    document.getElementById('dateFilter').value = new Date().toISOString().split('T')[0];
    document.getElementById('dateFilter').addEventListener('change', loadCars);
    document.getElementById('shiftFilter').addEventListener('change', loadCars);
    document.getElementById('statusFilter').addEventListener('change', loadCars);
    
    loadSupervisorWorkers();
    loadAdminHoldingCars();
    loadCars();
}

async function handleGlobalSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    const dropdown = document.getElementById('searchDropdown');
    
    if (!dropdown) return;
    
    if (searchTerm.length < 2) {
        dropdown.style.display = 'none';
        return;
    }
    
    try {
        const users = await apiCall('/users');
        let filtered;
        
        if (currentUser.role === 'supervisor') {
            filtered = users.filter(u => 
                u.role === 'worker' && 
                u.supervisor_id === currentUser.user_id &&
                (u.full_name.toLowerCase().includes(searchTerm) || 
                 u.username.toLowerCase().includes(searchTerm))
            );
        }
        
        displaySearchDropdown(filtered);
    } catch (error) {
        console.error('Search failed:', error);
    }
}

function displaySearchDropdown(users) {
    const dropdown = document.getElementById('searchDropdown');
    
    if (!dropdown) return;
    
    if (users.length === 0) {
        dropdown.innerHTML = '<div style="padding: 16px; text-align: center; color: #94a3b8;">No users found</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    dropdown.innerHTML = users.map(user => `
        <div onclick="showUserProfile(${user.user_id}, '${user.role}')" 
             style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;"
             onmouseover="this.style.background='#f8fafc'" 
             onmouseout="this.style.background='white'">
            <div>
                <div style="font-weight: 600; color: #0f172a;">${user.full_name}</div>
                <div style="font-size: 12px; color: #64748b;">${user.username} • ${user.role}</div>
            </div>
            ${user.role === 'worker' ? `
                <button onclick="event.stopPropagation(); downloadWorkerExcel(${user.user_id}, '${user.full_name}')" 
                        style="padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                    📥 Download
                </button>
            ` : ''}
        </div>
    `).join('');
    
    dropdown.style.display = 'block';
}

document.addEventListener('click', (e) => {
    const searchInput = document.getElementById('globalSearch');
    const dropdown = document.getElementById('searchDropdown');
    if (searchInput && dropdown && !searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

async function loadDashboardData() {
    try {
        const data = await apiCall('/dashboard');
        
        const totalCarsEl = document.getElementById('totalCars');
        const activeCarsEl = document.getElementById('activeCars');
        const warningCarsEl = document.getElementById('warningCars');
        const overdueCarsEl = document.getElementById('overdueCars');
        
        if (totalCarsEl) totalCarsEl.textContent = data.total_cars || 0;
        if (activeCarsEl) activeCarsEl.textContent = data.active_cars || 0;
        if (warningCarsEl) warningCarsEl.textContent = data.warning_cars || 0;
        if (overdueCarsEl) overdueCarsEl.textContent = data.overdue_cars || 0;
        
        if (currentUser.role !== 'worker') {
            const activeWorkersEl = document.getElementById('activeWorkers');
            if (activeWorkersEl) activeWorkersEl.textContent = data.active_workers || 0;
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

async function loadCars() {
    const shift = document.getElementById('shiftFilter')?.value || '';
    const status = document.getElementById('statusFilter')?.value || '';
    const date = document.getElementById('dateFilter')?.value || new Date().toISOString().split('T')[0];
    
    console.log('Loading cars with filters:', { shift, status, date });
    
    const params = new URLSearchParams();
    if (shift) params.append('shift', shift);
    if (status) params.append('status', status);
    params.append('date', date);
    
    try {
        const cars = await apiCall(`/cars?${params}`);
        console.log('Cars loaded:', cars);
        const parkedCars = cars.filter(c => !c.is_in_holding);
        displayCars(parkedCars);
    } catch (error) {
        console.error('Failed to load cars:', error);
        const tbody = document.getElementById('carsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #ef4444;">Error loading cars. Please refresh the page.</td></tr>';
        }
    }
}

function displayCars(cars) {
    // Support both carsTableBody (admin/supervisor dashboards) and parkedCarsTableBody (worker dashboard)
    const tbody = document.getElementById('carsTableBody') || document.getElementById('parkedCarsTableBody');
    
    console.log('Displaying cars:', cars ? cars.length : 0);
    
    if (!tbody) {
        console.error('Table body not found!');
        return;
    }
    
    if (!cars || cars.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">No cars found for selected filters</td></tr>';
        return;
    }
    
    tbody.innerHTML = cars.map(car => {
        const timeDiff = calculateTimeDifference(car.first_scan_time, car.last_scan_time);
        
        // Calculate hours from LAST SCAN TIME to NOW (not from first to last)
        const lastScanTime = new Date(car.last_scan_time);
        const now = new Date();
        const hoursFromLastScan = (now - lastScanTime) / (1000 * 60 * 60);
        
        // Calculate status based on hours from last scan to now
        const calculatedStatus = calculateStatusFromHours(hoursFromLastScan);
        const statusDisplay = getStatusDisplay(calculatedStatus);
        
        const workerDisplay = car.last_worker_id 
            ? `<a href="#" onclick="showWorkerProfile(${car.last_worker_id}); return false;" style="color: #6366f1; text-decoration: none; font-weight: 600;">${car.last_worker || 'N/A'}</a>`
            : (car.last_worker || 'N/A');
        
        return `
            <tr>
                <td><strong>${car.car_identifier}</strong></td>
                <td>${formatDateTime(car.first_scan_time)}</td>
                <td>${formatDateTime(car.last_scan_time)}</td>
                <td><span style="color: #64748b; font-weight: 600;">${timeDiff}</span></td>
                <td><strong>${car.scan_count}x</strong></td>
                <td>${hoursFromLastScan.toFixed(1)}h</td>
                <td>${statusDisplay}</td>
                <td>${workerDisplay}</td>
            </tr>
        `;
    }).join('');
    
    console.log('Cars displayed successfully');
}

function showScannerSection() {
    const mainContent = document.querySelector('.main-content');
    const statsGrid = document.querySelector('.stats-grid');
    
    if (statsGrid) {
        statsGrid.style.display = 'none';
    }
    
    const scannerHTML = `
        <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px;">
            <div class="card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none;">
                <div class="card-header" style="background: transparent; border: none; padding: 24px 28px; display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="card-title" style="color: white; font-size: 24px; margin: 0;">🔍 Scan Vehicle</h2>
                    <button onclick="endSession()" style="
                        padding: 12px 24px;
                        background: rgba(255,255,255,0.2);
                        color: white;
                        border: 2px solid white;
                        border-radius: 10px;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    " onmouseover="this.style.background='white'; this.style.color='#059669';" 
                       onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.color='white';">
                        <span style="font-size: 18px;">🚪</span>
                        <span>End Session</span>
                    </button>
                </div>
                <div class="card-body" style="padding: 0 28px 28px 28px;">
                    <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 16px; padding: 32px;">
                        <h3 style="margin-bottom: 20px; font-size: 18px; color: white; font-weight: 600;">Enter or Scan Car ID</h3>
                        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                            <input type="text" id="manualCarId" 
                                   placeholder="Enter Car ID or Barcode" 
                                   autofocus 
                                   style="flex: 1; padding: 18px; font-size: 18px; border: 3px solid rgba(255,255,255,0.3); border-radius: 12px; background: white; font-weight: 600; text-transform: uppercase;">
                            <button onclick="scanManually()" 
                                    style="padding: 18px 40px; font-size: 18px; font-weight: bold; background: white; color: #059669; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.2s;">
                                🚀 SCAN
                            </button>
                        </div>
                        
                        <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                            <h4 style="color: white; font-size: 16px; margin-bottom: 12px;">📍 Location</h4>
                            <div style="display: flex; gap: 12px;">
                                <label style="flex: 1; background: white; padding: 16px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                                    <input type="radio" name="carLocation" value="holding" id="locationHolding" style="width: 20px; height: 20px; cursor: pointer;">
                                    <span style="font-weight: 600; color: #059669; font-size: 16px;">📦 Holding Area</span>
                                </label>
                                <label style="flex: 1; background: white; padding: 16px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                                    <input type="radio" name="carLocation" value="parked" id="locationParked" checked style="width: 20px; height: 20px; cursor: pointer;">
                                    <span style="font-weight: 600; color: #059669; font-size: 16px;">🅿️ Parked</span>
                                </label>
                            </div>
                        </div>
                        
                        <div id="holdingAreaFields" style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; display: none;">
                            <h4 style="color: white; font-size: 16px; margin-bottom: 16px;">📦 Holding Area Details</h4>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                                <div>
                                    <label style="color: rgba(255,255,255,0.9); font-size: 13px; display: block; margin-bottom: 6px;">Vessel Name</label>
                                    <input type="text" id="vesselName" placeholder="Ship/Truck name" 
                                           style="width: 100%; padding: 10px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); font-size: 14px;">
                                </div>
                                <div>
                                    <label style="color: rgba(255,255,255,0.9); font-size: 13px; display: block; margin-bottom: 6px;">Vessel Type</label>
                                    <select id="vesselType" style="width: 100%; padding: 10px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); font-size: 14px;">
                                        <option value="ship">Ship</option>
                                        <option value="truck">Truck</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="color: rgba(255,255,255,0.9); font-size: 13px; display: block; margin-bottom: 6px;">Holding Area</label>
                                    <select id="holdingArea" style="width: 100%; padding: 10px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); font-size: 14px;">
                                        <option value="">Select Area</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="color: rgba(255,255,255,0.9); font-size: 13px; display: block; margin-bottom: 6px;">Stack Number</label>
                                    <input type="text" id="stackNumber" placeholder="Unit/Stack" 
                                           style="width: 100%; padding: 10px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); font-size: 14px;">
                                </div>
                            </div>
                        </div>
                        
                        <div id="scanResult" style="display: none; margin-top: 20px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.95); color: #059669; font-weight: 600; font-size: 16px;"></div>
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon primary">📊</div>
                    </div>
                    <div class="stat-value" id="totalCars">0</div>
                    <div class="stat-label">Total Cars Today</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon success">🟢</div>
                    </div>
                    <div class="stat-value" id="activeCars">0</div>
                    <div class="stat-label">Normal (< 4 hours)</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon warning">🟡</div>
                    </div>
                    <div class="stat-value" id="warningCars">0</div>
                    <div class="stat-label">Warning (4-12 hours)</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon danger">🔴</div>
                    </div>
                    <div class="stat-value" id="overdueCars">0</div>
                    <div class="stat-label">Overdue (12+ hours)</div>
                </div>
            </div>
        </div>
        
        <!-- SPACING -->
        <div style="height: 32px;"></div>
        
        <!-- Holding Area Table -->
        <div class="card" style="margin-bottom: 32px;">
            <div class="card-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                <h2 class="card-title" style="color: white;">📦 Holding Area Vehicles</h2>
                <div class="card-actions">
                    <button onclick="exportHoldingExcel()" class="btn-download-excel" style="background: white; color: #d97706;">
                        <span style="font-size: 20px;">📥</span>
                        <span>Download Excel</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="filter-bar">
                    <input type="date" id="holdingDateFilter" class="filter-select">
                    <select id="holdingShiftFilter" class="filter-select" onchange="loadAdminHoldingCars()">
                        <option value="">All Shifts</option>
                        <option value="1">Day Shift (6AM-6PM)</option>
                        <option value="2">Night Shift (6PM-6AM)</option>
                    </select>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>CAR ID</th>
                                <th>VESSEL</th>
                                <th>AREA</th>
                                <th>UNIT</th>
                                <th>WORKER</th>
                                <th>TIME</th>
                                <th>HOURS</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody id="holdingCarsTableBody">
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">No vehicles in holding area</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- Parked Vehicles Table -->
        <div class="card" style="margin-bottom: 32px;">
            <div class="card-header" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                <h2 class="card-title" style="color: white;">🚗 Parked Vehicles</h2>
                <div class="card-actions">
                    <button onclick="exportExcel()" class="btn-download-excel" style="background: white; color: #8b5cf6;">
                        <span style="font-size: 20px;">📥</span>
                        <span>Download Excel</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="filter-bar">
                    <input type="date" id="dateFilter" class="filter-select">
                    <select id="shiftFilter" class="filter-select" onchange="loadCars()">
                        <option value="">All Shifts</option>
                        <option value="1">Day Shift (6AM-6PM)</option>
                        <option value="2">Night Shift (6PM-6AM)</option>
                    </select>
                    <select id="statusFilter" class="filter-select" onchange="loadCars()">
                        <option value="">All Status</option>
                        <option value="green">🟢 Normal</option>
                        <option value="amber">🟡 Warning</option>
                        <option value="red">🔴 Overdue</option>
                    </select>
                </div>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>CAR ID</th>
                                <th>FIRST SCAN</th>
                                <th>LAST SCAN</th>
                                <th>TIME DIFF</th>
                                <th>SCANS</th>
                                <th>HOURS</th>
                                <th>STATUS</th>
                                <th>WORKER</th>
                            </tr>
                        </thead>
                        <tbody id="parkedCarsTableBody">
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">No parked vehicles</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    mainContent.insertAdjacentHTML('afterbegin', scannerHTML);
    
    loadHoldingAreas();
    
    document.querySelectorAll('input[name="carLocation"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const holdingFields = document.getElementById('holdingAreaFields');
            if (e.target.value === 'holding') {
                holdingFields.style.display = 'block';
            } else {
                holdingFields.style.display = 'none';
            }
        });
    });
    
    document.getElementById('manualCarId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            scanManually();
        }
    });
    
    document.getElementById('holdingDateFilter').value = new Date().toISOString().split('T')[0];
    document.getElementById('holdingDateFilter').addEventListener('change', loadAdminHoldingCars);
    document.getElementById('holdingShiftFilter').addEventListener('change', loadAdminHoldingCars);
    
    document.getElementById('dateFilter').value = new Date().toISOString().split('T')[0];
    document.getElementById('dateFilter').addEventListener('change', loadCars);
    document.getElementById('shiftFilter').addEventListener('change', loadCars);
    document.getElementById('statusFilter').addEventListener('change', loadCars);
    
    loadHoldingCars();
    loadCars();
}

async function loadHoldingAreas() {
    try {
        const areas = await apiCall('/holding-areas');
        const select = document.getElementById('holdingArea');
        if (select && areas) {
            select.innerHTML = '<option value="">Select Area</option>' + 
                areas.map(a => `<option value="${a.holding_area_id}">${a.area_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load holding areas:', error);
    }
}

function endSession() {
    if (confirm('Are you sure you want to END YOUR SESSION?\n\nThis will log you out.')) {
        clearToken();
        localStorage.removeItem('user');
        alert('✅ Session ended successfully!\n\nThank you for your work today!');
        window.location.href = '/';
    }
}

async function loadHoldingCars() {
    try {
        const date = document.getElementById('holdingDateFilter')?.value || new Date().toISOString().split('T')[0];
        const shift = document.getElementById('holdingShiftFilter')?.value;
        
        const params = new URLSearchParams();
        params.append('date', date);
        params.append('holding_only', 'true');
        if (shift) params.append('shift', shift);
        
        const cars = await apiCall(`/cars?${params}`);
        displayHoldingCars(cars);
    } catch (error) {
        console.error('Failed to load holding cars:', error);
    }
}

async function loadParkedCars() {
    try {
        const shift = document.getElementById('shiftFilter')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const date = document.getElementById('dateFilter')?.value || new Date().toISOString().split('T')[0];
        
        const params = new URLSearchParams();
        if (shift) params.append('shift', shift);
        if (status) params.append('status', status);
        params.append('date', date);
        
        const cars = await apiCall(`/cars?${params}`);
        displayParkedCars(cars);
    } catch (error) {
        console.error('Failed to load parked cars:', error);
    }
}

function displayHoldingCars(cars) {
    const tbody = document.getElementById('holdingCarsTableBody');
    if (!tbody) return;
    
    const holdingCars = cars.filter(c => c.is_in_holding);
    
    if (holdingCars.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #6b7280;">No vehicles in holding area</td></tr>';
        return;
    }
    
    tbody.innerHTML = holdingCars.map(car => {
        // Calculate hours from LAST SCAN TIME to NOW
        const lastScanTime = new Date(car.last_scan_time);
        const now = new Date();
        const hoursFromLastScan = (now - lastScanTime) / (1000 * 60 * 60);
        
        // Calculate status based on hours from last scan to now
        const calculatedStatus = calculateStatusFromHours(hoursFromLastScan);
        const statusDisplay = getStatusDisplay(calculatedStatus);
        const vesselDisplay = car.vessel_name ? `${car.vessel_name} (${car.vessel_type})` : '-';
        
        const workerDisplay = car.last_worker_id 
            ? `<a href="#" onclick="showWorkerProfile(${car.last_worker_id}); return false;" style="color: #6366f1; text-decoration: none; font-weight: 600;">${car.last_worker || 'N/A'}</a>`
            : (car.last_worker || 'N/A');
        
        return `
            <tr>
                <td><strong>${car.car_identifier}</strong></td>
                <td style="font-size: 12px;">${vesselDisplay}</td>
                <td style="font-size: 12px;">${car.holding_area_name || '-'}</td>
                <td style="font-size: 12px;">${car.stack_number || '-'}</td>
                <td>${workerDisplay}</td>
                <td>${formatDateTime(car.last_scan_time)}</td>
                <td>${hoursFromLastScan.toFixed(1)}h</td>
                <td>${statusDisplay}</td>
            </tr>
        `;
    }).join('');
}

function displayParkedCars(cars) {
    const tbody = document.getElementById('parkedCarsTableBody');
    if (!tbody) return;
    
    const parkedCars = cars.filter(c => !c.is_in_holding);
    
    if (parkedCars.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">No parked vehicles</td></tr>';
        return;
    }
    
    tbody.innerHTML = parkedCars.map(car => {
        const timeDiff = calculateTimeDifference(car.first_scan_time, car.last_scan_time);
        
        // Calculate hours from LAST SCAN TIME to NOW
        const lastScanTime = new Date(car.last_scan_time);
        const now = new Date();
        const hoursFromLastScan = (now - lastScanTime) / (1000 * 60 * 60);
        
        // Calculate status based on hours from last scan to now
        const calculatedStatus = calculateStatusFromHours(hoursFromLastScan);
        const statusDisplay = getStatusDisplay(calculatedStatus);
        
        const workerDisplay = car.last_worker_id 
            ? `<a href="#" onclick="showWorkerProfile(${car.last_worker_id}); return false;" style="color: #6366f1; text-decoration: none; font-weight: 600;">${car.last_worker || 'N/A'}</a>`
            : (car.last_worker || 'N/A');
        
        return `
            <tr>
                <td><strong>${car.car_identifier}</strong></td>
                <td>${formatDateTime(car.first_scan_time)}</td>
                <td>${formatDateTime(car.last_scan_time)}</td>
                <td><span style="color: #64748b; font-weight: 600;">${timeDiff}</span></td>
                <td><strong>${car.scan_count}x</strong></td>
                <td>${hoursFromLastScan.toFixed(1)}h</td>
                <td>${statusDisplay}</td>
                <td>${workerDisplay}</td>
            </tr>
        `;
    }).join('');
}

async function scanManually() {
    const input = document.getElementById('manualCarId');
    const carId = input.value.trim().toUpperCase();
    const resultDiv = document.getElementById('scanResult');
    
    const isHolding = document.getElementById('locationHolding').checked;
    
    const vesselName = isHolding ? document.getElementById('vesselName')?.value.trim() : '';
    const vesselType = isHolding ? document.getElementById('vesselType')?.value : 'ship';
    const holdingAreaId = isHolding ? document.getElementById('holdingArea')?.value : '';
    const stackNumber = isHolding ? document.getElementById('stackNumber')?.value.trim() : '';
    
    if (!carId) {
        alert('Please enter a car ID');
        return;
    }
    
    try {
        let vesselId = null;
        
        if (isHolding && vesselName) {
            const vesselData = await apiCall('/vessels', {
                method: 'POST',
                body: JSON.stringify({
                    vessel_name: vesselName,
                    vessel_type: vesselType,
                    arrival_date: new Date().toISOString().split('T')[0]
                })
            });
            vesselId = vesselData.vessel_id;
        }
        
        const scanData = {
            car_identifier: carId,
            vessel_id: vesselId,
            holding_area_id: holdingAreaId || null,
            stack_number: stackNumber,
            is_in_holding: isHolding
        };
        
        const data = await apiCall('/scan', {
            method: 'POST',
            body: JSON.stringify(scanData)
        });
        
        let resultHTML = `
            <div style="padding: 16px; border-radius: 8px;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
                    ✅ ${data.message}
                </div>
                <div style="font-size: 14px; margin-bottom: 8px;">
                    Car: <strong>${data.car.car_identifier}</strong> | 
                    Location: <strong>${isHolding ? '📦 Holding' : '🅿️ Parked'}</strong> | 
                    Scans: <strong>${data.car.scan_count}x</strong> | 
                    Status: <strong>${getStatusEmoji(data.car.status)}</strong>
                </div>`;
        
        if (data.previous_scans && data.previous_scans.length > 0) {
            resultHTML += `
                <div style="margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.2); border-radius: 8px; border-left: 4px solid #fbbf24;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: #92400e;">
                        ℹ️ Previously scanned by:
                    </div>`;
            
            data.previous_scans.forEach(scan => {
                resultHTML += `
                    <div style="font-size: 12px; margin-bottom: 4px; color: #78350f;">
                        • <strong>${scan.worker}</strong> (Shift ${scan.shift}) - ${scan.time_ago}
                    </div>`;
            });
            
            resultHTML += `</div>`;
        } else if (data.is_new) {
            resultHTML += `
                <div style="margin-top: 8px; font-size: 13px; color: #065f46; font-weight: 600;">
                    🆕 First time scanning this car today!
                </div>`;
        }
        
        resultHTML += `</div>`;
        
        resultDiv.innerHTML = resultHTML;
        resultDiv.style.display = 'block';
        input.value = '';
        
        if (document.getElementById('vesselName')) document.getElementById('vesselName').value = '';
        if (document.getElementById('stackNumber')) document.getElementById('stackNumber').value = '';
        if (document.getElementById('holdingArea')) document.getElementById('holdingArea').value = '';
        
        input.focus();
        
        loadDashboardData();
        loadHoldingCars();
        loadParkedCars();
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 5000);
    } catch (error) {
        // Check if it's a shift violation error
        if (error.message && error.message.includes('shift')) {
            // Extract shift info from error message
            const shiftMatch = error.message.match(/shift.*?(\d+):00/i);
            const shiftStart = shiftMatch ? shiftMatch[1] : 'your';
            
            const resultDiv = document.getElementById('scanResult');
            resultDiv.innerHTML = `
                <div style="padding: 16px; border-radius: 8px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-left: 4px solid #dc2626;">
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #7f1d1d;">
                        ⛔ ACCESS DENIED
                    </div>
                    <div style="font-size: 14px; margin-bottom: 12px; color: #b91c1c;">
                        ${error.message}
                    </div>
                    <div style="font-size: 13px; color: #991b1b; background: rgba(255,255,255,0.3); padding: 10px; border-radius: 6px;">
                        Your shift starts at <strong>${shiftStart}:00</strong>. Please wait until your shift begins.
                    </div>
                </div>
            `;
            resultDiv.style.display = 'block';
            input.value = '';
            input.focus();
            
            setTimeout(() => {
                resultDiv.style.display = 'none';
            }, 5000);
        } else {
            alert('Scan failed: ' + error.message);
        }
    }
}

// FIXED: exportExcel with auth token
async function exportExcel() {
    const shift = document.getElementById('shiftFilter')?.value || '';
    const date = document.getElementById('dateFilter')?.value || new Date().toISOString().split('T')[0];
    
    const params = new URLSearchParams();
    if (shift) params.append('shift', shift);
    params.append('date', date);
    
    try {
        const token = getToken();
        const response = await fetch(`${API_URL}/export?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `parking_report_${date}${shift ? '_shift' + shift : ''}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Excel exported successfully');
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export: ' + error.message);
    }
}

// User Management Functions
async function showUserManagement() {
    const existingModal = document.getElementById('userModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const userMgmtHTML = `
        <div id="userModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title" id="modalTitle">Add User</h3>
                </div>
                <form id="userForm">
                    <div class="form-group">
                        <label>Username <span style="color: #ef4444;">*</span></label>
                        <input type="text" id="userUsername" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label>Password <span style="color: #ef4444;">*</span></label>
                        <input type="password" id="userPassword" class="form-input" required placeholder="Enter password">
                    </div>
                    <div class="form-group">
                        <label>Role <span style="color: #ef4444;">*</span></label>
                        <select id="userRole" class="form-input" required>
                            <option value="">Select Role</option>
                            <option value="worker">Worker</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="form-group" id="shiftGroup">
                        <label>Assigned Shift <span style="color: #ef4444;">*</span></label>
                        <select id="userShift" class="form-input">
                            <option value="">Select Shift (Optional for Supervisors/Admins)</option>
                            <option value="1">Day Shift (6AM-6PM)</option>
                            <option value="2">Night Shift (6PM-6AM)</option>
                        </select>
                    </div>
                    <div class="form-group" id="supervisorGroup">
                        <label>Supervisor <span style="color: #ef4444;">*</span></label>
                        <select id="userSupervisor" class="form-input">
                            <option value="">Select Supervisor (Required for Workers)</option>
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" onclick="closeUserModal()" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('userManagementSection').insertAdjacentHTML('beforeend', userMgmtHTML);
    loadSupervisors();
    
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
    });
    
    const roleSelect = document.getElementById('userRole');
    if (roleSelect) {
        roleSelect.addEventListener('change', (e) => {
            const role = e.target.value;
            const isWorker = role === 'worker';
            
            const shiftGroup = document.getElementById('shiftGroup');
            const supervisorGroup = document.getElementById('supervisorGroup');
            
            if (shiftGroup && supervisorGroup) {
                shiftGroup.style.display = isWorker ? 'block' : 'none';
                supervisorGroup.style.display = isWorker ? 'block' : 'none';
                
                document.getElementById('userShift').required = isWorker;
                document.getElementById('userSupervisor').required = isWorker;
            }
            
            if (isWorker) {
                loadSupervisors();
            }
        });
    }
}

async function loadSupervisors() {
    try {
        const users = await apiCall('/users');
        const supervisors = users.filter(u => u.role === 'supervisor');
        const select = document.getElementById('userSupervisor');
        
        select.innerHTML = '<option value="">No Supervisor</option>' + 
            supervisors.map(s => `<option value="${s.user_id}">${s.full_name}</option>`).join('');
    } catch (error) {
        console.error('Failed to load supervisors:', error);
    }
}

function showAddUserModal() {
    document.getElementById('modalTitle').textContent = 'Add User';
    document.getElementById('userForm').reset();
    
    let shiftGroup = document.getElementById('shiftGroup');
    let supervisorGroup = document.getElementById('supervisorGroup');
    
    if (shiftGroup) shiftGroup.style.display = 'block';
    if (supervisorGroup) supervisorGroup.style.display = 'block';
    
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function saveUser() {
    const form = document.getElementById('userForm');
    
    const username = form.querySelector('#userUsername').value.trim();
    const password = form.querySelector('#userPassword').value;
    const role = form.querySelector('#userRole').value;
    const shift = form.querySelector('#userShift').value;
    const supervisor = form.querySelector('#userSupervisor').value;
    
    if (!username || !password || !role) {
        alert('Username, password and role are required');
        return;
    }
    
    if (role === 'worker') {
        if (!shift) {
            alert('⚠️ Shift is required for Workers!');
            return;
        }
        if (!supervisor) {
            alert('⚠️ Supervisor is required for Workers!');
            return;
        }
    }
    
    const userData = {
        username: username,
        full_name: username,
        password: password,
        role: role,
        assigned_shift: shift || null,
        supervisor_id: supervisor || null
    };
    
    try {
        await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        closeUserModal();
        await loadAllUsersUnified();
        alert('✅ User created successfully!\nUsername: ' + username);
    } catch (error) {
        console.error('Error creating user:', error);
        alert('❌ Failed to create user: ' + error.message);
    }
}

async function showWorkerProfile(workerId) {
    showUserProfile(workerId, 'worker');
}

async function showUserProfile(userId, userRole) {
    try {
        let data;
        if (userRole === 'worker') {
            data = await apiCall(`/workers/${userId}/profile`);
        } else {
            const users = await apiCall('/users');
            const user = users.find(u => u.user_id === userId);
            
            if (!user) {
                alert('User not found');
                return;
            }
            
            data = {
                worker: {
                    user_id: user.user_id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                    assigned_shift: user.assigned_shift,
                    is_active: user.is_active,
                    profile_image: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&size=200&background=${userRole === 'supervisor' ? '8b5cf6' : 'ef4444'}&color=fff&bold=true`
                },
                stats: {
                    today_scans: 0,
                    week_scans: 0,
                    total_scans: 0,
                    unique_cars: 0
                },
                recent_activity: []
            };
            
            if (userRole === 'supervisor') {
                const workers = users.filter(u => u.supervisor_id === userId && u.role === 'worker');
                data.team_size = workers.length;
            }
        }
        
        const worker = data.worker;
        const stats = data.stats;
        const recentActivity = data.recent_activity;
        
        const roleEmoji = worker.role === 'admin' ? '👑' : worker.role === 'supervisor' ? '👨‍💼' : '👷';
        const roleColor = worker.role === 'admin' ? '#ef4444' : worker.role === 'supervisor' ? '#8b5cf6' : '#10b981';
        
        const profileHTML = `
            <div class="modal active" id="workerProfileModal" style="z-index: 2000;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header" style="background: linear-gradient(135deg, ${roleColor} 0%, ${roleColor}dd 100%); color: white; padding: 24px;">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <img src="${worker.profile_image}" 
                                 alt="${worker.full_name}" 
                                 style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                            <div style="flex: 1;">
                                <h2 style="margin: 0 0 8px 0; font-size: 24px;">${roleEmoji} ${worker.full_name}</h2>
                                <p style="margin: 0; opacity: 0.9; font-size: 14px;">
                                    ${worker.role.charAt(0).toUpperCase() + worker.role.slice(1)}${worker.assigned_shift ? ` - Shift ${worker.assigned_shift}` : ''}
                                </p>
                            </div>
                            <button onclick="closeWorkerProfile()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 28px; cursor: pointer; padding: 4px 12px; border-radius: 8px; line-height: 1;">×</button>
                        </div>
                    </div>
                    
                    <div style="padding: 24px;">
                        ${worker.role === 'worker' ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 16px; margin-bottom: 16px; color: #1e293b;">📊 Performance Statistics</h3>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px; border-radius: 12px; text-align: center;">
                                    <p style="margin: 0 0 4px 0; font-size: 28px; font-weight: bold;">${stats.today_scans}</p>
                                    <p style="margin: 0; font-size: 11px; opacity: 0.9;">Today</p>
                                </div>
                                <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 16px; border-radius: 12px; text-align: center;">
                                    <p style="margin: 0 0 4px 0; font-size: 28px; font-weight: bold;">${stats.week_scans}</p>
                                    <p style="margin: 0; font-size: 11px; opacity: 0.9;">This Week</p>
                                </div>
                                <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 16px; border-radius: 12px; text-align: center;">
                                    <p style="margin: 0 0 4px 0; font-size: 28px; font-weight: bold;">${stats.total_scans}</p>
                                    <p style="margin: 0; font-size: 11px; opacity: 0.9;">Total</p>
                                </div>
                                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px; border-radius: 12px; text-align: center;">
                                    <p style="margin: 0 0 4px 0; font-size: 28px; font-weight: bold;">${stats.unique_cars}</p>
                                    <p style="margin: 0; font-size: 11px; opacity: 0.9;">Cars</p>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <h3 style="font-size: 16px; margin-bottom: 12px; color: #1e293b;">🔍 Recent Activity</h3>
                            <div style="max-height: 180px; overflow-y: auto; background: #f8fafc; border-radius: 12px; padding: 12px;">
                                ${recentActivity.length > 0 ? recentActivity.map(scan => `
                                    <div style="display: flex; justify-content: space-between; padding: 10px; background: white; border-radius: 8px; margin-bottom: 6px;">
                                        <span style="font-weight: 600; color: #0f172a;">🚗 ${scan.car_identifier}</span>
                                        <span style="color: #64748b; font-size: 13px;">${new Date(scan.scan_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                `).join('') : '<p style="text-align: center; color: #94a3b8; padding: 20px;">No recent activity</p>'}
                            </div>
                        </div>
                        ` : worker.role === 'supervisor' ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 16px; margin-bottom: 16px; color: #1e293b;">👥 Supervisor Information</h3>
                            <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
                                <div style="margin-bottom: 12px;">
                                    <span style="color: #64748b; font-size: 14px;">Username:</span>
                                    <span style="font-weight: 600; color: #0f172a; margin-left: 8px;">${worker.username}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <span style="color: #64748b; font-size: 14px;">Role:</span>
                                    <span style="font-weight: 600; color: #8b5cf6; margin-left: 8px;">Supervisor</span>
                                </div>
                                ${data.team_size !== undefined ? `
                                <div>
                                    <span style="color: #64748b; font-size: 14px;">Team Size:</span>
                                    <span style="font-weight: 600; color: #0f172a; margin-left: 8px;">${data.team_size} workers</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        ` : `
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 16px; margin-bottom: 16px; color: #1e293b;">👑 Administrator Information</h3>
                            <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
                                <div style="margin-bottom: 12px;">
                                    <span style="color: #64748b; font-size: 14px;">Username:</span>
                                    <span style="font-weight: 600; color: #0f172a; margin-left: 8px;">${worker.username}</span>
                                </div>
                                <div>
                                    <span style="color: #64748b; font-size: 14px;">Access Level:</span>
                                    <span style="font-weight: 600; color: #ef4444; margin-left: 8px;">Full System Access</span>
                                </div>
                            </div>
                        </div>
                        `}
                        
                        <div style="margin-top: 20px; text-align: center;">
                            <button onclick="closeWorkerProfile()" class="btn btn-secondary" style="padding: 10px 32px;">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', profileHTML);
        
    } catch (error) {
        console.error('Error loading user profile:', error);
        alert('Failed to load profile: ' + error.message);
    }
}

function closeWorkerProfile() {
    const modal = document.getElementById('workerProfileModal');
    if (modal) {
        modal.remove();
    }
}

async function loadSupervisorWorkers() {
    try {
        const users = await apiCall('/users');
        const workers = users.filter(u => u.role === 'worker' && u.supervisor_id === currentUser.user_id);
        displaySupervisorWorkers(workers);
    } catch (error) {
        console.error('Failed to load workers:', error);
    }
}

function displaySupervisorWorkers(workers) {
    const container = document.getElementById('supervisorWorkersList');
    
    if (!container) return;
    
    if (workers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">No workers assigned to you yet.</p>';
        return;
    }
    
    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                    <tr>
                        <th style="padding: 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Worker Name</th>
                        <th style="padding: 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Shift</th>
                        <th style="padding: 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Status</th>
                        <th style="padding: 12px; text-align: left; color: white; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${workers.map(worker => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 12px;">
                                <a href="#" onclick="showUserProfile(${worker.user_id}, 'worker'); return false;" 
                                   style="color: #6366f1; text-decoration: none; font-weight: 600;">
                                    ${worker.full_name}
                                </a>
                            </td>
                            <td style="padding: 12px;">Shift ${worker.assigned_shift}</td>
                            <td style="padding: 12px;">
                                <span class="badge ${worker.is_active ? 'badge-success' : 'badge-danger'}" style="font-size: 11px; padding: 4px 8px;">
                                    ${worker.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td style="padding: 12px;">
                                <button onclick="downloadWorkerExcel(${worker.user_id}, '${worker.full_name}')" 
                                        class="btn btn-success btn-sm" style="padding: 5px 10px; font-size: 12px;">
                                    📥 Download
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function downloadWorkerExcel(workerId, workerName) {
    const dateInput = document.getElementById('dateFilter');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    
    const params = new URLSearchParams();
    params.append('worker_id', workerId);
    params.append('date', date);
    
    try {
        const token = getToken();
        const response = await fetch(`${API_URL}/export?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workerName.replace(/\s+/g, '_')}_report_${date}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Excel downloaded for:', workerName);
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download Excel: ' + error.message);
    }
}

if (document.getElementById('dateFilter')) {
    document.getElementById('dateFilter').value = new Date().toISOString().split('T')[0];
} 

function loadAdminHoldingCars() {
    const date = document.getElementById('holdingDateFilter')?.value || new Date().toISOString().split('T')[0];
    const shift = document.getElementById('holdingShiftFilter')?.value;
    
    const params = new URLSearchParams({ date, holding_only: 'true' });
    if (shift) params.append('shift', shift);
    
    apiCall(`/cars?${params}`)
        .then(cars => {
            const holdingCars = cars.filter(c => c.is_in_holding);
            displayAdminHoldingCars(holdingCars);
        })
        .catch(error => console.error('Error:', error));
}

function displayAdminHoldingCars(cars) {
    const tbody = document.getElementById('holdingCarsTableBody');
    if (!tbody) return;
    
    if (cars.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No vehicles in holding area</td></tr>';
        return;
    }
    
    tbody.innerHTML = cars.map(car => {
        // Calculate hours from LAST SCAN TIME to NOW
        const lastScanTime = new Date(car.last_scan_time);
        const now = new Date();
        const hoursFromLastScan = (now - lastScanTime) / (1000 * 60 * 60);
        
        // Calculate status based on hours from last scan to now
        const calculatedStatus = calculateStatusFromHours(hoursFromLastScan);
        const statusDisplay = getStatusDisplay(calculatedStatus);
        const vessel = car.vessel_name ? `${car.vessel_name} (${car.vessel_type})` : '-';
        
        const workerDisplay = car.last_worker_id 
            ? `<a href="#" onclick="showWorkerProfile(${car.last_worker_id}); return false;" style="color: #6366f1; text-decoration: none; font-weight: 600;">${car.last_worker || 'N/A'}</a>`
            : (car.last_worker || 'N/A');
        
        return `
            <tr>
                <td><strong>${car.car_identifier}</strong></td>
                <td>${vessel}</td>
                <td>${car.holding_area_name || '-'}</td>
                <td>${car.stack_number || '-'}</td>
                <td>${workerDisplay}</td>
                <td>${formatDateTime(car.last_scan_time)}</td>
                <td>${hoursFromLastScan.toFixed(1)}h</td>
                <td>${statusDisplay}</td>
            </tr>
        `;
    }).join('');
}

// FIXED: exportHoldingExcel with proper auth token
function exportHoldingExcel() {
    const date = document.getElementById('holdingDateFilter')?.value || new Date().toISOString().split('T')[0];
    const shift = document.getElementById('holdingShiftFilter')?.value;
    
    const params = new URLSearchParams();
    params.append('date', date);
    if (shift) params.append('shift', shift);
    
    try {
        const token = getToken();
        fetch(`${API_URL}/export/holding?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Export failed');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `holding_area_${date}${shift ? '_shift' + shift : ''}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            console.log('Holding area Excel exported successfully');
        });
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export: ' + error.message);
    }
}