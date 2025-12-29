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
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
    const diff = new Date(lastScan) - new Date(firstScan);
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
        
        document.getElementById('totalCars').textContent = data.total_cars || 0;
        document.getElementById('activeCars').textContent = data.active_cars || 0;
        document.getElementById('warningCars').textContent = data.warning_cars || 0;
        document.getElementById('overdueCars').textContent = data.overdue_cars || 0;
        
        if (currentUser.role !== 'worker') {
            document.getElementById('activeWorkers').textContent = data.active_workers || 0;
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

async function loadCars() {
    const shift = document.getElementById('shiftFilter')?.value || '';
    const status = document.getElementById('statusFilter')?.value || '';
    const date = document.getElementById('dateFilter')?.value || new Date().toISOString().split('T')[0];
    
    const params = new URLSearchParams();
    if (shift) params.append('shift', shift);
    if (status) params.append('status', status);
    params.append('date', date);
    
    try {
        const cars = await apiCall(`/cars?${params}`);
        displayCars(cars);
    } catch (error) {
        console.error('Failed to load cars:', error);
    }
}

function displayCars(cars) {
    const tbody = document.getElementById('carsTableBody');
    
    if (!cars || cars.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #6b7280;">No cars found</td></tr>';
        return;
    }
    
    tbody.innerHTML = cars.map(car => {
        const hoursParked = calculateHoursParked(car.first_scan_time, car.last_scan_time);
        return `
            <tr>
                <td><strong>${car.car_identifier}</strong></td>
                <td>${formatDateTime(car.first_scan_time)}</td>
                <td>${formatDateTime(car.last_scan_time)}</td>
                <td><strong>${car.scan_count}x</strong></td>
                <td>${hoursParked}h</td>
                <td><span class="badge ${getStatusBadgeClass(car.status)}">${car.status}</span></td>
                <td>${car.last_worker || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

function showScannerSection() {
    const scannerHTML = `
        <div class="card scanner-container">
            <div class="card-header">
                <h2 class="card-title">🔍 Scan Vehicle</h2>
            </div>
            <div class="card-body">
                <div class="scanner-box">
                    <h3 style="margin-bottom: 16px;">Enter or Scan Car ID</h3>
                    <div class="scanner-input-group">
                        <input type="text" id="manualCarId" class="scanner-input" 
                               placeholder="Enter Car ID or Barcode" autofocus>
                        <button onclick="scanManually()" class="btn btn-primary btn-sm">Scan</button>
                    </div>
                    <div id="scanResult" style="display: none;" class="scan-result"></div>
                    <p style="margin-top: 20px; font-size: 14px; opacity: 0.8;">
                        Tip: Use your phone camera to scan QR codes or barcodes, then enter the code above
                    </p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('dashboardContent').insertAdjacentHTML('afterbegin', scannerHTML);
    
    document.getElementById('manualCarId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            scanManually();
        }
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
    
    window.location.href = `${API_URL}/export?${params}&token=${getToken()}`;
}

// User Management
async function showUserManagement() {
    const userMgmtHTML = `
        <div class="card" style="margin-top: 24px;">
            <div class="card-header">
                <h2 class="card-title">👥 User Management</h2>
                <div class="card-actions">
                    <button onclick="showAddUserModal()" class="btn btn-primary btn-sm">
                        ➕ Add User
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
    
    document.getElementById('userRole').addEventListener('change', (e) => {
        const isWorker = e.target.value === 'worker';
        document.getElementById('shiftGroup').style.display = isWorker ? 'block' : 'none';
        document.getElementById('supervisorGroup').style.display = isWorker ? 'block' : 'none';
    });
    
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
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
    const userData = {
        username: document.getElementById('userUsername').value,
        full_name: document.getElementById('userFullName').value,
        role: document.getElementById('userRole').value,
        assigned_shift: document.getElementById('userShift').value || null,
        supervisor_id: document.getElementById('userSupervisor').value || null
    };
    
    try {
        await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        closeUserModal();
        loadUsers();
        alert('User created successfully! Default password: temp123');
    } catch (error) {
        alert('Failed to create user: ' + error.message);
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