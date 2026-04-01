/**
 * Authentication Module
 * Handles user login, registration, and token management
 */

// API Base URL - Change this to your backend URL
const API_BASE_URL = 'http://localhost:8000/api';

// Token storage key
const TOKEN_KEY = 'chat_token';
const USER_KEY = 'chat_user';

/**
 * Check if user is authenticated on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        validateToken(token);
    }
});

/**
 * Validate stored token and restore session
 */
async function validateToken(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            showChatView(user);
        } else {
            // Token invalid, clear storage
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        }
    } catch (error) {
        console.error('Token validation error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

/**
 * Handle user login
 */
async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    // Validation
    if (!username || !password) {
        showError(errorDiv, 'Please enter both username and password');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and user data
            localStorage.setItem(TOKEN_KEY, data.access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            
            // Clear form
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            hideError(errorDiv);
            
            // Show chat interface
            showChatView(data.user);
            showNotification('Welcome back!', 'success');
        } else {
            showError(errorDiv, data.detail || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError(errorDiv, 'Connection error. Please try again.');
    }
}

/**
 * Handle user registration
 */
async function handleRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errorDiv = document.getElementById('register-error');
    
    // Validation
    if (!username || !email || !password || !confirm) {
        showError(errorDiv, 'Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError(errorDiv, 'Password must be at least 6 characters');
        return;
    }
    
    if (password !== confirm) {
        showError(errorDiv, 'Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and user data
            localStorage.setItem(TOKEN_KEY, data.access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            
            // Clear form
            document.getElementById('reg-username').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-confirm').value = '';
            hideError(errorDiv);
            
            // Show chat interface
            showChatView(data.user);
            showNotification('Account created successfully!', 'success');
        } else {
            showError(errorDiv, data.detail || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError(errorDiv, 'Connection error. Please try again.');
    }
}

/**
 * Logout user
 */
function logout() {
    // Close WebSocket connection
    if (window.chatWebSocket) {
        window.chatWebSocket.close();
    }
    
    // Clear storage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    // Reset UI
    document.getElementById('auth-view').classList.add('active');
    document.getElementById('chat-view').classList.remove('active');
    
    // Clear chat data
    window.currentChat = null;
    window.users = [];
    window.rooms = [];
    
    showNotification('Logged out successfully', 'success');
}

/**
 * Show error message in form
 */
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

/**
 * Hide error message
 */
function hideError(element) {
    element.textContent = '';
    element.classList.remove('show');
}

/**
 * Switch to register form
 */
function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    hideError(document.getElementById('login-error'));
}

/**
 * Switch to login form
 */
function showLogin() {
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    hideError(document.getElementById('register-error'));
}

/**
 * Show chat view and initialize chat
 */
function showChatView(user) {
    // Update user info in sidebar
    document.getElementById('current-username').textContent = user.username;
    document.getElementById('current-user-initial').textContent = user.username.charAt(0).toUpperCase();
    
    // Switch views
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('chat-view').classList.add('active');
    
    // Initialize chat
    initChat();
}

/**
 * Get auth token
 */
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get current user
 */
function getCurrentUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
}

/**
 * Show notification toast
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}