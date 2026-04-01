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
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    // Clear previous errors
    errorDiv.textContent = '';
    
    if (!username || !password) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }
    
    try {
        console.log('Attempting login to:', `${API_BASE_URL}/api/auth/login`);
        
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        console.log('Login response status:', response.status);
        
        const data = await response.json();
        console.log('Login response data:', data);
        
        if (response.ok) {
            localStorage.setItem(TOKEN_KEY, data.access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            showChatView(data.user);
            connectWebSocket();
            showNotification('Login successful!', 'success');
        } else {
            // Display specific error from backend
            const errorMsg = data.detail || data.message || 'Login failed';
            errorDiv.textContent = errorMsg;
            console.error('Login failed:', errorMsg);
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please check your connection.';
        console.error('Login error:', error);
    }
}

// Handle register
async function handleRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errorDiv = document.getElementById('register-error');
    
    // Clear previous errors
    errorDiv.textContent = '';
    
    // Validation
    if (!username || !email || !password || !confirm) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }
    
    if (password !== confirm) {
        errorDiv.textContent = 'Passwords do not match';
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        return;
    }
    
    try {
        console.log('Attempting register to:', `${API_BASE_URL}/api/auth/register`);
        console.log('Register data:', { username, email, password: '***' });
        
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                username: username, 
                email: email, 
                password: password 
            })
        });
        
        console.log('Register response status:', response.status);
        
        const data = await response.json();
        console.log('Register response data:', data);
        
        if (response.ok) {
            localStorage.setItem(TOKEN_KEY, data.access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            showChatView(data.user);
            connectWebSocket();
            showNotification('Registration successful!', 'success');
        } else {
            // Display specific error from backend
            const errorMsg = data.detail || data.message || 'Registration failed';
            errorDiv.textContent = errorMsg;
            console.error('Registration failed:', errorMsg);
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please check your connection.';
        console.error('Register error:', error);
    }
}

// Show register form
function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    // Clear errors when switching
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
}

// Show login form
function showLogin() {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    // Clear errors when switching
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
}

// Show chat view
function showChatView(user) {
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('chat-view').classList.add('active');
    document.getElementById('current-username').textContent = user.username;
    document.getElementById('current-user-initial').textContent = user.username.charAt(0).toUpperCase();
    
    // Initialize chat
    initChat();
}

// Logout
function logout() {
    if (ws) {
        ws.close();
    }
    clearSession();
    showNotification('Logged out successfully', 'info');
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