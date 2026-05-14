const API_BASE_URL = 'https://chat-backend-123.onrender.com';

async function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) return false;
    
    try {
        const response = await fetch(API_BASE_URL + '/api/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        return response.ok;
    } catch (e) { return false; }
}

async function login(username, password) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) errorDiv.textContent = '';
    
    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        
        const response = await fetch(API_BASE_URL + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
        }
        
        const data = await response.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.replace('index.html');
        
    } catch (error) {
        if (errorDiv) errorDiv.textContent = error.message;
        else alert('Login failed: ' + error.message);
    }
}

async function register(username, email, password) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) errorDiv.textContent = '';
    
    try {
        const response = await fetch(API_BASE_URL + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
        }
        
        alert('Registration successful! Please login.');
        window.location.replace('login.html');
        
    } catch (error) {
        if (errorDiv) errorDiv.textContent = error.message;
        else alert('Registration failed: ' + error.message);
    }
}

function logout() {
    localStorage.clear();
    window.location.replace('login.html');
}

window.checkAuth = checkAuth;
window.login = login;
window.register = register;
window.logout = logout;
window.API_BASE_URL = API_BASE_URL;
