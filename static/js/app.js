// API Configuration
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
        
        if (response.status === 401) {
            clearToken();
            window.location.href = '/';
            return null;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
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
        'active': 'badge-success',
        'warning': 'badge-warning',
        'overdue': 'badge-danger',
        'normal': 'badge-success'
    };
    return classes[status] || 'badge-success';
}

function calculateHoursParked(firstScan, lastScan) {
    // Calculate hours from FIRST scan to NOW (not to last scan)
    const diff = new Date() - new Date(firstScan);
    return (diff / (1000 * 60 * 60)).toFixed(1);
}

// Login Page
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            const data = await apiCall('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            setToken(data.token);
            setUser(data.user);
            window.location.href = '/dashboard';
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
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
    // Set user info
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userRole').textContent = currentUser.role;
    
    // Update navbar title based on role
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
    
    // Load role-specific dashboard
    if (currentUser.role === 'worker') {
        loadWorkerDashboard();
    } else if (currentUser.role === 'supervisor') {
        loadSupervisorDashboard();
    } else if (currentUser.role === 'admin') {
        loadAdminDashboard();
    }
    
    document.getElementById('shiftFilter')?.addEventListener('change', loadCars);
    document.getElementById('statusFilter')?.addEventListener('change', loadCars);
    document.getElementById('dateFilter')?.addEventListener('change', loadCars);
}

function loadWorkerDashboard() {
    showScannerSection();
    loadDashboardData();
    loadCars();
    document.getElementById('userManagementSection')?.remove();
    // Workers don't see search
    document.getElementById('navbarSearch').style.display = 'none';
}

function loadSupervisorDashboard() {
    // Show search for supervisors
    document.getElementById('navbarSearch').style.display = 'flex';
    document.getElementById('globalSearch').placeholder = '🔍 Search your team workers...';
    
    loadDashboardData();
    loadCars();
    showSupervisorDashboard();
    document.getElementById('userManagementSection')?.remove();
}

function loadAdminDashboard() {
    // Hide navbar search (we'll use integrated search in the table)
    document.getElementById('navbarSearch').style.display = 'none';
    
    // Create the new unified admin dashboard
    createUnifiedAdminDashboard();
}

function createUnifiedAdminDashboard() {
    const mainContent = document.querySelector('.main-content');
    
    if (!mainContent) return;
    
    // Build complete admin dashboard HTML
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
                    <div class="stat-icon success">✅</div>
                </div>
                <div class="stat-value" id="activeCars">0</div>
                <div class="stat-label">Active (< 4 hours)</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon warning">⚠️</div>
                </div>
                <div class="stat-value" id="warningCars">0</div>
                <div class="stat-label">Warning (4-12 hours)</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon danger">🚨</div>
                </div>
                <div class="stat-value" id="overdueCars">0</div>
                <div class="stat-label">Overdue (12+ hours)</div>
            </div>
        </div>
        
        <!-- Unified User Management -->
        <div class="card" style="margin-bottom: 24px;">
            <div class="card-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
                <h2 class="card-title" style="color: white;">👥 User Management</h2>
                <div class="card-actions">
                    <button onclick="showAddUserModal()" class="btn-add-user">
                        <span style="font-size: 18px;">➕</span>
                        <span>Add User</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <!-- Filter Bar -->
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
                
                <!-- Unified Table -->
                <div class="unified-table-container">
                    <table class="unified-user-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Shift</th>
                                <th>Supervisor</th>
                                <th>Status</th>
                                <th>Actions</th>
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
        
        <!-- Vehicles Section -->
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">🚗 Parked Vehicles</h2>
                <div class="card-actions">
                    <button onclick="exportExcel()" class="btn-download-excel">
                        <span style="font-size: 20px;">📥</span>
                        <span>Download Excel</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="filter-bar">
                    <input type="date" id="dateFilter" class="filter-select">
                    <select id="shiftFilter" class="filter-select">
                        <option value="">All Shifts</option>
                        <option value="1">Shift 1 (6AM-10AM)</option>
                        <option value="2">Shift 2 (10AM-2PM)</option>
                        <option value="3">Shift 3 (2PM-6PM)</option>
                        <option value="4">Shift 4 (6PM-10PM)</option>
                        <option value="5">Shift 5 (10PM-2AM)</option>
                    </select>
                    <select id="statusFilter" class="filter-select">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="warning">Warning</option>
                        <option value="overdue">Overdue</option>
                    </select>
                </div>
                
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>CAR ID</th>
                                <th>FIRST SCAN</th>
                                <th>LAST SCAN</th>
                                <th>SCANS</th>
                                <th>HOURS</th>
                                <th>STATUS</th>
                                <th>OVERDUE BY</th>
                                <th>WORKER</th>
                            </tr>
                        </thead>
                        <tbody id="carsTableBody">
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">Loading...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- User Modal Container -->
        <div id="userManagementSection"></div>
    `;
    
    // Set today's date
    document.getElementById('dateFilter').value = new Date().toISOString().split('T')[0];
    
    // Add event listeners
    document.getElementById('shiftFilter').addEventListener('change', loadCars);
    document.getElementById('statusFilter').addEventListener('change', loadCars);
    document.getElementById('dateFilter').addEventListener('change', loadCars);
    
    // Load all data
    loadDashboardData();
    loadCars();
    loadAllUsersUnified();
    showUserManagement(); // This adds the modal
}

// Store users globally for filtering
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
    
    // Update count
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
                    ${user.full_name}
                </a>
            </td>
            <td class="text-secondary">${user.username}</td>
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
            <td>
                <div class="action-buttons">
                    ${user.role === 'worker' ? `
                        <button onclick="downloadWorkerExcel(${user.user_id}, '${user.full_name}')" 
                                class="btn-action btn-excel" title="Download Excel">
                            📥
                        </button>
                    ` : ''}
                    <button onclick="toggleUserStatus(${user.user_id}, ${user.is_active})" 
                            class="btn-action ${user.is_active ? 'btn-deactivate' : 'btn-activate'}" 
                            title="${user.is_active ? 'Deactivate' : 'Activate'}">
                        ${user.is_active ? '🚫' : '✅'}
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterUsersByRole(role) {
    currentRoleFilter = role;
    
    // Update button styles
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
    
    // Apply filters
    applyUserFilters();
}

function searchUsersInTable() {
    applyUserFilters();
}

function applyUserFilters() {
    const searchTerm = document.getElementById('userSearchInput')?.value.toLowerCase().trim() || '';
    
    let filtered = allUnifiedUsers;
    
    // Filter by role
    if (currentRoleFilter) {
        filtered = filtered.filter(u => u.role === currentRoleFilter);
    }
    
    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(u => 
            u.full_name.toLowerCase().includes(searchTerm) || 
            u.username.toLowerCase().includes(searchTerm)
        );
    }
    
    displayUnifiedUserTable(filtered);
}

async function toggleUserStatus(userId, currentStatus) {
    const action = currentStatus ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }
    
    try {
        await apiCall(`/users/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: !currentStatus })
        });
        
        // Reload users
        await loadAllUsersUnified();
        alert(`User ${action}d successfully!`);
    } catch (error) {
        alert(`Failed to ${action} user: ` + error.message);
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
    `;
    
    const mainContent = document.querySelector('.main-content');
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid && mainContent) {
        statsGrid.insertAdjacentHTML('afterend', dashboardHTML);
    }
    loadSupervisorWorkers();
}

// Global Search Handler (for Supervisor navbar search)
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
            // Supervisors see only their team
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

// Close dropdown when clicking outside
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
        displayCars(cars);
    } catch (error) {
        console.error('Failed to load cars:', error);
        const tbody = document.getElementById('carsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">Error loading cars. Please refresh the page.</td></tr>';
        }
    }
}

function displayCars(cars) {
    const tbody = document.getElementById('carsTableBody');
    
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
        const hoursParked = calculateHoursParked(car.first_scan_time, car.last_scan_time);
        
        // Calculate overdue time display
        let overdueDisplay = '';
        if (hoursParked >= 12) {
            const hours = Math.floor(hoursParked);
            const minutes = Math.floor((hoursParked - hours) * 60);
            overdueDisplay = `<span style="color: #ef4444; font-weight: bold;">🚨 ${hours}h ${minutes}m</span>`;
        } else if (hoursParked >= 4) {
            const hours = Math.floor(hoursParked);
            const minutes = Math.floor((hoursParked - hours) * 60);
            overdueDisplay = `<span style="color: #f59e0b; font-weight: bold;">⚠️ ${hours}h ${minutes}m</span>`;
        }
        
        // Make worker name clickable if available
        const workerDisplay = car.last_worker_id 
            ? `<a href="#" onclick="showWorkerProfile(${car.last_worker_id}); return false;" style="color: #6366f1; text-decoration: none; font-weight: 600;">${car.last_worker || 'N/A'}</a>`
            : (car.last_worker || 'N/A');
        
        return `
            <tr>
                <td><strong>${car.car_identifier}</strong></td>
                <td>${formatDateTime(car.first_scan_time)}</td>
                <td>${formatDateTime(car.last_scan_time)}</td>
                <td><strong>${car.scan_count}x</strong></td>
                <td>${hoursParked}h</td>
                <td><span class="badge ${getStatusBadgeClass(car.status)}">${car.status}</span></td>
                <td>${overdueDisplay || '-'}</td>
                <td>${workerDisplay}</td>
            </tr>
        `;
    }).join('');
    
    console.log('Cars displayed successfully');
}

function showScannerSection() {
    // For workers: Reorganize layout - scanner at top left, stats below in grid
    const mainContent = document.querySelector('.main-content');
    const statsGrid = document.querySelector('.stats-grid');
    
    // Hide original stats temporarily
    if (statsGrid) {
        statsGrid.style.display = 'none';
    }
    
    const scannerHTML = `
        <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px;">
            <!-- Scanner Box - Prominent at Top -->
            <div class="card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none;">
                <div class="card-header" style="background: transparent; border: none; padding: 24px 28px;">
                    <h2 class="card-title" style="color: white; font-size: 24px; margin: 0;">🔍 Scan Vehicle</h2>
                </div>
                <div class="card-body" style="padding: 0 28px 28px 28px;">
                    <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 16px; padding: 32px;">
                        <h3 style="margin-bottom: 20px; font-size: 18px; color: white; font-weight: 600;">Enter or Scan Car ID</h3>
                        <div style="display: flex; gap: 12px;">
                            <input type="text" id="manualCarId" 
                                   placeholder="Enter Car ID or Barcode" 
                                   autofocus 
                                   style="flex: 1; padding: 18px; font-size: 18px; border: 3px solid rgba(255,255,255,0.3); border-radius: 12px; background: white; font-weight: 600; text-transform: uppercase;">
                            <button onclick="scanManually()" 
                                    style="padding: 18px 40px; font-size: 18px; font-weight: bold; background: white; color: #059669; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.2s;">
                                🚀 SCAN
                            </button>
                        </div>
                        <div id="scanResult" style="display: none; margin-top: 20px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.95); color: #059669; font-weight: 600; font-size: 16px;"></div>
                        <p style="margin-top: 24px; font-size: 14px; color: rgba(255,255,255,0.9); text-align: center;">
                            💡 Tip: Use your phone camera to scan QR codes or barcodes
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Stats Grid Below Scanner -->
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
                        <div class="stat-icon success">✅</div>
                    </div>
                    <div class="stat-value" id="activeCars">0</div>
                    <div class="stat-label">Active (< 4 hours)</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon warning">⚠️</div>
                    </div>
                    <div class="stat-value" id="warningCars">0</div>
                    <div class="stat-label">Warning (4-12 hours)</div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon danger">🚨</div>
                    </div>
                    <div class="stat-value" id="overdueCars">0</div>
                    <div class="stat-label">Overdue (12+ hours)</div>
                </div>
            </div>
        </div>
    `;
    
    // Insert at the very beginning
    mainContent.insertAdjacentHTML('afterbegin', scannerHTML);
    
    document.getElementById('manualCarId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            scanManually();
        }
    });
    
    // Add hover effect to scan button
    const scanBtn = document.querySelector('button[onclick="scanManually()"]');
    scanBtn.addEventListener('mouseenter', () => {
        scanBtn.style.transform = 'scale(1.05)';
        scanBtn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
    });
    scanBtn.addEventListener('mouseleave', () => {
        scanBtn.style.transform = 'scale(1)';
        scanBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    });
}

async function scanManually() {
    const input = document.getElementById('manualCarId');
    const carId = input.value.trim().toUpperCase();
    const resultDiv = document.getElementById('scanResult');
    
    if (!carId) {
        alert('Please enter a car ID');
        return;
    }
    
    try {
        const data = await apiCall('/scan', {
            method: 'POST',
            body: JSON.stringify({ car_identifier: carId })
        });
        
        // Build result message
        let resultHTML = `
            <div style="padding: 16px; border-radius: 8px;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
                    ✅ ${data.message}
                </div>
                <div style="font-size: 14px; margin-bottom: 8px;">
                    Car: <strong>${data.car.car_identifier}</strong> | 
                    Scans: <strong>${data.car.scan_count}x</strong> | 
                    Status: <strong>${data.car.status.toUpperCase()}</strong>
                </div>`;
        
        // Show previous scans by other workers
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
        input.focus();
        
        loadDashboardData();
        loadCars();
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 5000); // Show for 5 seconds (was 3)
    } catch (error) {
        alert('Scan failed: ' + error.message);
    }
}

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
        
        // Get the blob
        const blob = await response.blob();
        
        // Create download link
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

// User Management
async function showUserManagement() {
    const userMgmtHTML = `
        <div class="card" style="margin-top: 24px;">
            <div class="card-header">
                <h2 class="card-title">👥 User Management</h2>
                <div class="card-actions">
                    <button onclick="showAddUserModal()" style="
                        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                        color: white;
                        border: none;
                        padding: 14px 28px;
                        font-size: 16px;
                        font-weight: 600;
                        border-radius: 12px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(99, 102, 241, 0.4)'"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(99, 102, 241, 0.3)'">
                        <span style="font-size: 20px;">➕</span>
                        <span>Add User</span>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Full Name</th>
                                <th>Role</th>
                                <th>Shift</th>
                                <th>Supervisor</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="usersTableBody">
                            <tr><td colspan="7" class="loading">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div id="userModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title" id="modalTitle">Add User</h3>
                </div>
                <form id="userForm">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="userUsername" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="userFullName" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="userPassword" class="form-input" required placeholder="Enter password">
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select id="userRole" class="form-input" required>
                            <option value="">Select Role</option>
                            <option value="worker">Worker</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="form-group" id="shiftGroup" style="display: none;">
                        <label>Assigned Shift</label>
                        <select id="userShift" class="form-input">
                            <option value="">Select Shift</option>
                            <option value="1">Shift 1 (6AM-10AM)</option>
                            <option value="2">Shift 2 (10AM-2PM)</option>
                            <option value="3">Shift 3 (2PM-6PM)</option>
                            <option value="4">Shift 4 (6PM-10PM)</option>
                            <option value="5">Shift 5 (10PM-2AM)</option>
                        </select>
                    </div>
                    <div class="form-group" id="supervisorGroup" style="display: none;">
                        <label>Supervisor</label>
                        <select id="userSupervisor" class="form-input">
                            <option value="">No Supervisor</option>
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
    
    document.getElementById('dashboardContent').insertAdjacentHTML('beforeend', userMgmtHTML);
    loadUsers();
    loadSupervisors();
    
    // Add form submit event listener
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
    });
    
    document.getElementById('userRole').addEventListener('change', (e) => {
        const role = e.target.value;
        const isWorker = role === 'worker';
        const isSupervisor = role === 'supervisor';
        
        // Show/hide shift selection for workers
        document.getElementById('shiftGroup').style.display = isWorker ? 'block' : 'none';
        
        // Show/hide supervisor selection
        document.getElementById('supervisorGroup').style.display = isWorker ? 'block' : 'none';
        
        // Load appropriate supervisors
        if (isWorker) {
            loadSupervisors();
        }
    });
}

async function loadUsers() {
    try {
        const users = await apiCall('/users');
        displayUsers(users);
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <a href="#" onclick="showUserProfile(${user.user_id}, '${user.role}'); return false;" 
                   style="color: #6366f1; text-decoration: none; font-weight: 600;">
                    ${user.username}
                </a>
            </td>
            <td>
                <a href="#" onclick="showUserProfile(${user.user_id}, '${user.role}'); return false;" 
                   style="color: #6366f1; text-decoration: none; font-weight: 600;">
                    ${user.full_name}
                </a>
            </td>
            <td><span class="badge badge-${user.role === 'admin' ? 'danger' : 'success'}">${user.role}</span></td>
            <td>${user.assigned_shift ? `Shift ${user.assigned_shift}` : '-'}</td>
            <td>${user.supervisor_name || '-'}</td>
            <td><span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button onclick="toggleUserStatus(${user.user_id}, ${user.is_active})" 
                        class="btn btn-sm ${user.is_active ? 'btn-secondary' : 'btn-success'}" 
                        style="padding: 4px 12px;">
                    ${user.is_active ? 'Deactivate' : 'Activate'}
                </button>
            </td>
        </tr>
    `).join('');
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
    
    // Hide shift and supervisor fields initially (until worker is selected)
    document.getElementById('shiftGroup').style.display = 'none';
    document.getElementById('supervisorGroup').style.display = 'none';
    
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function saveUser() {
    // Get form element
    const form = document.getElementById('userForm');
    
    // Get values directly from form
    const username = form.querySelector('#userUsername').value.trim();
    const fullName = form.querySelector('#userFullName').value.trim();
    const password = form.querySelector('#userPassword').value;
    const role = form.querySelector('#userRole').value;
    const shift = form.querySelector('#userShift').value;
    const supervisor = form.querySelector('#userSupervisor').value;
    
    console.log('Raw form values:', {
        username: username,
        fullName: fullName,
        password: password ? '***' : 'empty',
        role: role,
        shift: shift,
        supervisor: supervisor
    });
    
    // Build userData object
    const userData = {
        username: username,
        full_name: fullName,
        password: password,
        role: role,
        assigned_shift: shift || null,
        supervisor_id: supervisor || null
    };
    
    console.log('Prepared user data:', JSON.stringify({...userData, password: '***'}, null, 2));
    
    // Simple validation
    if (!username) {
        alert('Username is required');
        return;
    }
    
    if (!fullName) {
        alert('Full Name is required');
        return;
    }
    
    if (!password) {
        alert('Password is required');
        return;
    }
    
    if (!role) {
        alert('Role is required');
        return;
    }
    
    if (!role) {
        alert('Role is required - please select Worker or Supervisor');
        return;
    }
    
    try {
        console.log('Calling API with:', userData);
        const response = await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        console.log('Success! Response:', response);
        closeUserModal();
        loadUsers();
        alert('✅ User created successfully!\nUsername: ' + username + '\nPassword: temp123');
    } catch (error) {
        console.error('Error creating user:', error);
        alert('❌ Failed to create user: ' + error.message);
    }
}

async function toggleUserStatus(userId, currentStatus) {
    try {
        await apiCall(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: !currentStatus })
        });
        loadUsers();
    } catch (error) {
        alert('Failed to update user: ' + error.message);
    }
}

// Set today's date as default
if (document.getElementById('dateFilter')) {
    document.getElementById('dateFilter').value = new Date().toISOString().split('T')[0];
}

// Worker Profile Modal
async function showWorkerProfile(workerId) {
    try {
        const data = await apiCall(`/workers/${workerId}/profile`);
        
        const worker = data.worker;
        const stats = data.stats;
        const recentActivity = data.recent_activity;
        
        // Create profile modal HTML
        const profileHTML = `
            <div class="modal active" id="workerProfileModal" style="z-index: 2000;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 24px;">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <img src="${worker.profile_image || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(worker.full_name) + '&size=200&background=6366f1&color=fff&bold=true'}" 
                                 alt="${worker.full_name}" 
                                 style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                            <div style="flex: 1;">
                                <h2 style="margin: 0 0 8px 0; font-size: 24px;">${worker.full_name}</h2>
                                <p style="margin: 0; opacity: 0.9; font-size: 14px;">
                                    ${worker.role.charAt(0).toUpperCase() + worker.role.slice(1)} - Shift ${worker.assigned_shift}
                                </p>
                            </div>
                            <button onclick="closeWorkerProfile()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 28px; cursor: pointer; padding: 4px 12px; border-radius: 8px; line-height: 1;">×</button>
                        </div>
                    </div>
                    
                    <div style="padding: 24px;">
                        <!-- Statistics -->
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
                        
                        <!-- Recent Activity -->
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
                        
                        <div style="margin-top: 20px; text-align: center;">
                            <button onclick="closeWorkerProfile()" class="btn btn-secondary" style="padding: 10px 32px;">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert modal
        document.body.insertAdjacentHTML('beforeend', profileHTML);
        
    } catch (error) {
        console.error('Error loading worker profile:', error);
        alert('Failed to load worker profile: ' + error.message);
    }
}

function closeWorkerProfile() {
    const modal = document.getElementById('workerProfileModal');
    if (modal) {
        modal.remove();
    }
}

// Universal User Profile (Workers, Supervisors, Admins)
async function showUserProfile(userId, userRole) {
    try {
        // Use different endpoint based on role
        let data;
        if (userRole === 'worker') {
            data = await apiCall(`/workers/${userId}/profile`);
        } else {
            // For supervisors and admins, get basic info
            const users = await apiCall('/users');
            const user = users.find(u => u.user_id === userId);
            
            if (!user) {
                alert('User not found');
                return;
            }
            
            // Build data structure similar to worker profile
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
            
            // For supervisors, get their team stats
            if (userRole === 'supervisor') {
                // Get workers under this supervisor
                const workers = users.filter(u => u.supervisor_id === userId && u.role === 'worker');
                data.team_size = workers.length;
            }
        }
        
        const worker = data.worker;
        const stats = data.stats;
        const recentActivity = data.recent_activity;
        
        // Role-specific emoji and color
        const roleEmoji = worker.role === 'admin' ? '👑' : worker.role === 'supervisor' ? '👨‍💼' : '👷';
        const roleColor = worker.role === 'admin' ? '#ef4444' : worker.role === 'supervisor' ? '#8b5cf6' : '#10b981';
        
        // Create profile modal HTML
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
                        <!-- Statistics for Workers -->
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
                        
                        <!-- Recent Activity -->
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
                        <!-- Info for Supervisors -->
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
                        <!-- Info for Admins -->
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
        
        // Insert modal
        document.body.insertAdjacentHTML('beforeend', profileHTML);
        
    } catch (error) {
        console.error('Error loading user profile:', error);
        alert('Failed to load profile: ' + error.message);
    }
}

// Supervisor Worker Management
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
            <table style="width: 100%; font-size: 13px;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 10px; text-align: left;">Worker Name</th>
                        <th style="padding: 10px; text-align: left;">Shift</th>
                        <th style="padding: 10px; text-align: left;">Status</th>
                        <th style="padding: 10px; text-align: left;">Actions</th>
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

// Download Excel for Specific Worker
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