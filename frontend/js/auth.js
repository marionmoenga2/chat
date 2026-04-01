/**
 * Authentication Module
 * Handles login, register, and token management
 */

// Get token from localStorage
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// Get current user from localStorage
function getCurrentUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
}

// Handle login
async function handleLogin() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    if (!username || !password) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem(TOKEN_KEY, data.access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            showChatView(data.user);
            connectWebSocket();
        } else {
            errorDiv.textContent = data.detail || 'Login failed';
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        console.error('Login error:', error);
    }
}

// Handle register
async function handleRegister() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errorDiv = document.getElementById('register-error');
    
    if (!username || !email || !password || !confirm) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }
    
    if (password !== confirm) {
        errorDiv.textContent = 'Passwords do not match';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem(TOKEN_KEY, data.access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            showChatView(data.user);
            connectWebSocket();
        } else {
            errorDiv.textContent = data.detail || 'Registration failed';
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        console.error('Register error:', error);
    }
}

// Show register form
function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

// Show login form
function showLogin() {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

// Show chat view
function showChatView(user) {
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('chat-view').classList.add('active');
    document.getElementById('current-username').textContent = user.username;
    document.getElementById('current-user-initial').textContent = user.username.charAt(0).toUpperCase();
    
    // Load initial data
    loadUsers();
    loadRooms();
}

// Logout
function logout() {
    if (ws) {
        ws.close();
    }
    clearSession();
}

// Make functions globally accessible
window.getToken = getToken;
window.getCurrentUser = getCurrentUser;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.showChatView = showChatView;
window.logout = logout;