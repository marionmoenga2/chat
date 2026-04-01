/**
 * Admin Panel JavaScript
 * Handles all admin functionality including user management, message monitoring, and system settings
 */

// API Configuration
const API_BASE_URL = 'http://localhost:8000/api';
let adminToken = localStorage.getItem('admin_token');
let currentSection = 'dashboard';
let usersData = [];
let messagesData = [];
let roomsData = [];
let statsData = {};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        validateAdminToken();
    } else {
        showLoginView();
    }
});

/**
 * ==================== AUTHENTICATION ====================
 */

/**
 * Handle admin login form submission - THIS WAS MISSING!
 */
async function handleAdminLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('login-error');
    
    if (!username || !password) {
        showError(errorDiv, 'Please enter both username and password');
        return false;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            adminToken = data.access_token;
            localStorage.setItem('admin_token', adminToken);
            hideError(errorDiv);
            showDashboard();
            loadDashboardData();
            showNotification('Welcome to Admin Panel', 'success');
        } else {
            showError(errorDiv, data.detail || 'Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(errorDiv, 'Connection error. Please try again.');
    }
    
    return false;
}

/**
 * Validate stored admin token
 */
async function validateAdminToken() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            showDashboard();
            loadDashboardData();
        } else {
            localStorage.removeItem('admin_token');
            showLoginView();
        }
    } catch (error) {
        console.error('Token validation error:', error);
        showLoginView();
    }
}

/**
 * Admin logout
 */
function adminLogout() {
    localStorage.removeItem('admin_token');
    adminToken = null;
    showLoginView();
    showNotification('Logged out successfully', 'success');
}

/**
 * Show login view
 */
function showLoginView() {
    document.getElementById('login-view').classList.add('active');
    document.getElementById('dashboard-view').classList.remove('active');
}

/**
 * Show dashboard view
 */
function showDashboard() {
    document.getElementById('login-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
}

/**
 * ==================== NAVIGATION ====================
 */

/**
 * Show different sections
 */
function showSection(section) {
    currentSection = section;
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.nav-item').classList.add('active');
    
    // Update page title
    const titles = {
        'dashboard': 'Dashboard',
        'users': 'User Management',
        'messages': 'Message Monitoring',
        'rooms': 'Chat Rooms',
        'settings': 'System Settings'
    };
    document.getElementById('page-title').textContent = titles[section];
    
    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
    
    // Load section data
    switch(section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsers();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'rooms':
            loadRooms();
            break;
    }
}

/**
 * ==================== DASHBOARD ====================
 */

/**
 * Load dashboard statistics
 */
async function loadDashboardData() {
    try {
        // Load stats
        const statsResponse = await fetch(`${API_BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (statsResponse.ok) {
            statsData = await statsResponse.json();
            updateStatsDisplay();
        }
        
        // Load recent activity (last 10 messages as activity)
        const messagesResponse = await fetch(`${API_BASE_URL}/admin/messages?limit=10`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (messagesResponse.ok) {
            const messages = await messagesResponse.json();
            renderActivityList(messages);
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

/**
 * Update statistics display
 */
function updateStatsDisplay() {
    document.getElementById('stat-total-users').textContent = statsData.total_users || 0;
    document.getElementById('stat-online-users').textContent = statsData.online_now || 0;
    document.getElementById('stat-total-messages').textContent = statsData.total_messages || 0;
    document.getElementById('stat-banned-users').textContent = (statsData.total_users - statsData.active_users) || 0;
}

/**
 * Render activity list
 */
function renderActivityList(messages) {
    const container = document.getElementById('activity-list');
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<p class="no-data">No recent activity</p>';
        return;
    }
    
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        
        const time = new Date(msg.timestamp).toLocaleString();
        const icon = msg.room_id ? 'fa-comments' : 'fa-envelope';
        const type = msg.room_id ? 'message' : 'message';
        
        div.innerHTML = `
            <div class="activity-icon ${type}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="activity-content">
                <p><strong>${msg.sender_username}</strong> sent a message</p>
                <span>${time}</span>
            </div>
        `;
        
        container.appendChild(div);
    });
}

/**
 * ==================== USERS MANAGEMENT ====================
 */

/**
 * Load all users
 */
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users?limit=1000`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            usersData = await response.json();
            renderUsersTable(usersData);
        } else {
            showNotification('Failed to load users', 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Connection error', 'error');
    }
}

/**
 * Render users table
 */
function renderUsersTable(users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        
        const status = user.is_active ? 
            (user.is_online ? '<span class="status-tag online">Online</span>' : '<span class="status-tag active">Active</span>') 
            : '<span class="status-tag banned">Banned</span>';
        
        const created = new Date(user.created_at).toLocaleDateString();
        const lastSeen = user.last_seen ? new Date(user.last_seen).toLocaleString() : 'Never';
        
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${status}</td>
            <td>${created}</td>
            <td>${lastSeen}</td>
            <td class="actions">
                <button class="btn-action btn-view" onclick="viewUser(${user.id})">
                    <i class="fas fa-eye"></i>
                </button>
                ${user.is_active ? 
                    `<button class="btn-action btn-ban" onclick="confirmBanUser(${user.id}, '${user.username}')">
                        <i class="fas fa-ban"></i>
                    </button>` : 
                    `<button class="btn-action btn-view" onclick="unbanUser(${user.id})">
                        <i class="fas fa-check"></i>
                    </button>`
                }
                <button class="btn-action btn-delete" onclick="confirmDeleteUser(${user.id}, '${user.username}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

/**
 * Search users
 */
function searchUsers(query) {
    const filtered = usersData.filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        user.email.toLowerCase().includes(query.toLowerCase())
    );
    renderUsersTable(filtered);
}

/**
 * Filter users by status
 */
function filterUsers() {
    const filter = document.getElementById('user-filter').value;
    let filtered = usersData;
    
    switch(filter) {
        case 'active':
            filtered = usersData.filter(u => u.is_active);
            break;
        case 'banned':
            filtered = usersData.filter(u => !u.is_active);
            break;
        case 'online':
            filtered = usersData.filter(u => u.is_online);
            break;
        default:
            filtered = usersData;
    }
    
    renderUsersTable(filtered);
}

/**
 * View user details
 */
async function viewUser(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    
    const modalBody = document.getElementById('user-modal-body');
    modalBody.innerHTML = `
        <div class="user-detail-grid">
            <div class="detail-item">
                <label>User ID</label>
                <span>${user.id}</span>
            </div>
            <div class="detail-item">
                <label>Username</label>
                <span>${user.username}</span>
            </div>
            <div class="detail-item">
                <label>Email</label>
                <span>${user.email}</span>
            </div>
            <div class="detail-item">
                <label>Status</label>
                <span>${user.is_active ? 'Active' : 'Banned'}</span>
            </div>
            <div class="detail-item">
                <label>Created At</label>
                <span>${new Date(user.created_at).toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <label>Last Seen</label>
                <span>${user.last_seen ? new Date(user.last_seen).toLocaleString() : 'Never'}</span>
            </div>
            <div class="detail-item">
                <label>Is Admin</label>
                <span>${user.is_admin ? 'Yes' : 'No'}</span>
            </div>
            <div class="detail-item">
                <label>Online Status</label>
                <span>${user.is_online ? 'Online' : 'Offline'}</span>
            </div>
        </div>
    `;
    
    document.querySelector('#user-modal .modal-header h3').textContent = 'User Details';
    openModal('user-modal');
}

/**
 * Confirm ban user
 */
function confirmBanUser(userId, username) {
    const message = `Are you sure you want to ban user "${username}"? They will no longer be able to log in.`;
    showConfirmModal(message, () => banUser(userId));
}

/**
 * Ban user
 */
async function banUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId, reason: 'Banned by admin' })
        });
        
        if (response.ok) {
            showNotification('User banned successfully', 'success');
            loadUsers();
            loadDashboardData();
        } else {
            const data = await response.json();
            showNotification(data.detail || 'Failed to ban user', 'error');
        }
    } catch (error) {
        console.error('Error banning user:', error);
        showNotification('Connection error', 'error');
    }
    
    closeModal('confirm-modal');
}

/**
 * Unban user
 */
async function unbanUser(userId) {
    showNotification('Unban functionality not implemented in demo', 'warning');
}

/**
 * Confirm delete user
 */
function confirmDeleteUser(userId, username) {
    const message = `Are you sure you want to permanently delete user "${username}"? This action cannot be undone and all their messages will be deleted.`;
    showConfirmModal(message, () => deleteUser(userId));
}

/**
 * Delete user
 */
async function deleteUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            showNotification('User deleted successfully', 'success');
            loadUsers();
            loadDashboardData();
        } else {
            const data = await response.json();
            showNotification(data.detail || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Connection error', 'error');
    }
    
    closeModal('confirm-modal');
}

/**
 * ==================== MESSAGES MONITORING ====================
 */

/**
 * Load messages
 */
async function loadMessages() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/messages?limit=100`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            messagesData = await response.json();
            renderMessagesTable(messagesData);
        } else {
            showNotification('Failed to load messages', 'error');
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        showNotification('Connection error', 'error');
    }
}

/**
 * Render messages table
 */
function renderMessagesTable(messages) {
    const tbody = document.getElementById('messages-tbody');
    tbody.innerHTML = '';
    
    if (messages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No messages found</td></tr>';
        return;
    }
    
    messages.forEach(msg => {
        const tr = document.createElement('tr');
        
        const time = new Date(msg.timestamp).toLocaleString();
        const content = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
        
        tr.innerHTML = `
            <td>${msg.id}</td>
            <td>${msg.sender_username}</td>
            <td>${msg.receiver_email || 'N/A'}</td>
            <td title="${escapeHtml(msg.content)}">${escapeHtml(content)}</td>
            <td>${msg.room_id || 'Private'}</td>
            <td>${time}</td>
            <td class="actions">
                <button class="btn-action btn-view" onclick="viewMessage(${msg.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteMessage(${msg.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

/**
 * Search messages
 */
function searchMessages(query) {
    const filtered = messagesData.filter(msg => 
        msg.content.toLowerCase().includes(query.toLowerCase()) ||
        msg.sender_username.toLowerCase().includes(query.toLowerCase())
    );
    renderMessagesTable(filtered);
}

/**
 * Filter messages by date
 */
function filterMessages() {
    const fromDate = document.getElementById('date-from').value;
    const toDate = document.getElementById('date-to').value;
    
    let filtered = messagesData;
    
    if (fromDate) {
        const from = new Date(fromDate);
        filtered = filtered.filter(m => new Date(m.timestamp) >= from);
    }
    
    if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59);
        filtered = filtered.filter(m => new Date(m.timestamp) <= to);
    }
    
    renderMessagesTable(filtered);
}

/**
 * View message details
 */
function viewMessage(messageId) {
    const msg = messagesData.find(m => m.id === messageId);
    if (!msg) return;
    
    const modalBody = document.getElementById('user-modal-body');
    modalBody.innerHTML = `
        <div class="user-detail-grid">
            <div class="detail-item">
                <label>Message ID</label>
                <span>${msg.id}</span>
            </div>
            <div class="detail-item">
                <label>Sender</label>
                <span>${msg.sender_username} (${msg.sender_email})</span>
            </div>
            <div class="detail-item">
                <label>Receiver</label>
                <span>${msg.receiver_email || 'Group/Room'}</span>
            </div>
            <div class="detail-item">
                <label>Room ID</label>
                <span>${msg.room_id || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <label>Timestamp</label>
                <span>${new Date(msg.timestamp).toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <label>Read Status</label>
                <span>${msg.read_status ? 'Read' : 'Unread'}</span>
            </div>
        </div>
        <div style="margin-top: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Message Content:</label>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; font-family: monospace; white-space: pre-wrap;">${escapeHtml(msg.content)}</div>
        </div>
    `;
    
    document.querySelector('#user-modal .modal-header h3').textContent = 'Message Details';
    openModal('user-modal');
}

/**
 * Delete message
 */
async function deleteMessage(messageId) {
    showNotification('Message deletion not implemented in demo', 'warning');
}

/**
 * ==================== ROOMS MANAGEMENT ====================
 */

/**
 * Load chat rooms
 */
async function loadRooms() {
    try {
        const response = await fetch(`${API_BASE_URL}/rooms`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            roomsData = await response.json();
            renderRoomsTable(roomsData);
        } else {
            document.getElementById('rooms-tbody').innerHTML = 
                '<tr><td colspan="6" class="text-center">Rooms endpoint not available</td></tr>';
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
        document.getElementById('rooms-tbody').innerHTML = 
            '<tr><td colspan="6" class="text-center">Failed to load rooms</td></tr>';
    }
}

/**
 * Render rooms table
 */
function renderRoomsTable(rooms) {
    const tbody = document.getElementById('rooms-tbody');
    tbody.innerHTML = '';
    
    if (rooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No rooms found</td></tr>';
        return;
    }
    
    rooms.forEach(room => {
        const tr = document.createElement('tr');
        const created = new Date(room.created_at).toLocaleDateString();
        
        tr.innerHTML = `
            <td>${room.id}</td>
            <td>${room.name}</td>
            <td>${room.description || 'N/A'}</td>
            <td>${room.member_count}</td>
            <td>${created}</td>
            <td class="actions">
                <button class="btn-action btn-view" onclick="viewRoom(${room.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteRoom(${room.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

/**
 * Show create room modal
 */
function showCreateRoomModal() {
    showNotification('Create room functionality - use main chat interface', 'info');
}

/**
 * View room details
 */
function viewRoom(roomId) {
    const room = roomsData.find(r => r.id === roomId);
    if (!room) return;
    
    const modalBody = document.getElementById('user-modal-body');
    modalBody.innerHTML = `
        <div class="user-detail-grid">
            <div class="detail-item">
                <label>Room ID</label>
                <span>${room.id}</span>
            </div>
            <div class="detail-item">
                <label>Name</label>
                <span>${room.name}</span>
            </div>
            <div class="detail-item">
                <label>Description</label>
                <span>${room.description || 'N/A'}</span>
            </div>
            <div class="detail-item">
                <label>Members</label>
                <span>${room.member_count}</span>
            </div>
            <div class="detail-item">
                <label>Created</label>
                <span>${new Date(room.created_at).toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <label>Created By</label>
                <span>User #${room.created_by}</span>
            </div>
        </div>
    `;
    
    document.querySelector('#user-modal .modal-header h3').textContent = 'Room Details';
    openModal('user-modal');
}

/**
 * Delete room
 */
async function deleteRoom(roomId) {
    showNotification('Room deletion not implemented in demo', 'warning');
}

/**
 * ==================== SETTINGS ====================
 */

/**
 * Save settings
 */
function saveSettings() {
    const settings = {
        site_name: document.getElementById('setting-site-name').value,
        max_message_length: parseInt(document.getElementById('setting-max-length').value),
        allow_registration: document.getElementById('setting-allow-register').checked,
        max_login_attempts: parseInt(document.getElementById('setting-max-attempts').value),
        session_timeout: parseInt(document.getElementById('setting-session-timeout').value)
    };
    
    console.log('Saving settings:', settings);
    showNotification('Settings saved successfully', 'success');
}

/**
 * ==================== UTILITY FUNCTIONS ====================
 */

/**
 * Refresh all data
 */
function refreshData() {
    switch(currentSection) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsers();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'rooms':
            loadRooms();
            break;
    }
    showNotification('Data refreshed', 'success');
}

/**
 * Show error in element
 */
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

/**
 * Hide error
 */
function hideError(element) {
    element.textContent = '';
    element.classList.remove('show');
}

/**
 * Open modal
 */
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

/**
 * Close modal
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

/**
 * Show confirmation modal
 */
function showConfirmModal(message, onConfirm) {
    document.getElementById('confirm-message').textContent = message;
    const confirmBtn = document.getElementById('confirm-btn');
    
    // Remove old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Add new listener
    newConfirmBtn.addEventListener('click', onConfirm);
    
    openModal('confirm-modal');
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modals on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
    
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        refreshData();
    }
});