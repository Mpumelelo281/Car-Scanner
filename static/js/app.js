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
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userRole').textContent = currentUser.role;
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        clearToken();
        localStorage.removeItem('user');
        window.location.href = '/';
    });
    
    loadDashboardData();
    loadCars();
    
    if (currentUser.role === 'worker') {
        showScannerSection();
        document.getElementById('userManagementSection')?.remove();
    }
    
    if (currentUser.role === 'admin') {
        showUserManagement();
    }
    
    document.getElementById('shiftFilter')?.addEventListener('change', loadCars);
    document.getElementById('statusFilter')?.addEventListener('change', loadCars);
    document.getElementById('dateFilter')?.addEventListener('change', loadCars);
}

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
        
        resultDiv.innerHTML = `
            ✅ ${data.message}<br>
            <small>Car: ${data.car.car_identifier} | Scans: ${data.car.scan_count}x</small>
        `;
        resultDiv.style.display = 'block';
        input.value = '';
        input.focus();
        
        loadDashboardData();
        loadCars();
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 3000);
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
                        <label>Role</label>
                        <select id="userRole" class="form-input" required>
                            <option value="worker">Worker</option>
                            <option value="supervisor">Supervisor</option>
                        </select>
                    </div>
                    <div class="form-group" id="shiftGroup">
                        <label>Assigned Shift</label>
                        <select id="userShift" class="form-input">
                            <option value="">No Shift</option>
                            <option value="1">Shift 1 (6AM-10AM)</option>
                            <option value="2">Shift 2 (10AM-2PM)</option>
                            <option value="3">Shift 3 (2PM-6PM)</option>
                            <option value="4">Shift 4 (6PM-10PM)</option>
                        </select>
                    </div>
                    <div class="form-group" id="supervisorGroup">
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
        const isWorker = e.target.value === 'worker';
        document.getElementById('shiftGroup').style.display = isWorker ? 'block' : 'none';
        document.getElementById('supervisorGroup').style.display = isWorker ? 'block' : 'none';
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
            <td>${user.username}</td>
            <td>${user.full_name}</td>
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
    const role = form.querySelector('#userRole').value;
    const shift = form.querySelector('#userShift').value;
    const supervisor = form.querySelector('#userSupervisor').value;
    
    console.log('Raw form values:', {
        username: username,
        fullName: fullName,
        role: role,
        shift: shift,
        supervisor: supervisor
    });
    
    // Build userData object
    const userData = {
        username: username,
        full_name: fullName,
        role: role,
        assigned_shift: shift || null,
        supervisor_id: supervisor || null
    };
    
    console.log('Prepared user data:', JSON.stringify(userData, null, 2));
    
    // Simple validation
    if (!username) {
        alert('Username is required');
        return;
    }
    
    if (!fullName) {
        alert('Full Name is required');
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