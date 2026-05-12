const API_BASE_URL = 'https://chat-backend-rg75.onrender.com';

function initializeChat() {
    console.log('Chat initialized');
    loadUsers();
    
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
}

async function loadUsers() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    try {
        const response = await fetch(API_BASE_URL + '/api/users/online', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        displayUsers(users);
    } catch (e) {
        console.error('Error loading users:', e);
    }
}

function displayUsers(users) {
    const list = document.getElementById('onlineUsersList');
    const count = document.getElementById('onlineCount');
    
    if (!list || !count) return;
    
    list.innerHTML = '';
    count.textContent = users.length;
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="width:30px;height:30px;border-radius:50%;background:#3498db;display:flex;align-items:center;justify-content:center;color:white;margin-right:10px;">
                <i class="fas fa-user" style="font-size:12px;"></i>
            </div>
            <span>${user.username}</span>
        `;
        li.style.cssText = 'display:flex;align-items:center;padding:10px;cursor:pointer;border-radius:5px;transition:background 0.2s;';
        li.addEventListener('mouseover', () => li.style.background = '#34495e');
        li.addEventListener('mouseout', () => li.style.background = 'transparent');
        li.addEventListener('click', () => startChat(user));
        list.appendChild(li);
    });
}

function startChat(user) {
    document.getElementById('emptyState').classList.add('hidden');
    const container = document.getElementById('messagesContainer');
    if (container) container.classList.remove('hidden');
    
    document.getElementById('partnerName').textContent = user.username;
    const status = document.getElementById('partnerStatus');
    if (status) status.textContent = 'Online';
}

async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;
    
    const area = document.getElementById('messagesArea');
    const div = document.createElement('div');
    div.style.cssText = 'background:#667eea;color:white;padding:10px 15px;border-radius:18px;margin:5px 0;align-self:flex-end;max-width:70%;';
    div.textContent = content;
    area.appendChild(div);
    input.value = '';
}

window.initializeChat = initializeChat;
