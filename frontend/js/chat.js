const API_BASE_URL = 'http://127.0.0.1:8000';

function initializeChat() {
    console.log('Chat initialized');
    loadUsers();
    
    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    document.getElementById('messageInput').addEventListener('input', updateCharCounter);
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
            <div class="avatar" style="width:30px;height:30px;border-radius:50%;background:#3498db;display:flex;align-items:center;justify-content:center;color:white;margin-right:10px;">
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

function updateCharCounter() {
    const input = document.getElementById('messageInput');
    const counter = document.getElementById('charCounter');
    if (counter) counter.textContent = input.value.length + '/2000';
    document.getElementById('sendBtn').disabled = input.value.trim() === '';
}

async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;
    
    displayMessage({
        content: content,
        sender: { username: 'You' },
        timestamp: new Date().toISOString()
    }, true);
    
    input.value = '';
    updateCharCounter();
}

function displayMessage(message, isSent) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    div.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-time" style="font-size:11px;margin-top:4px;opacity:0.7;">${new Date(message.timestamp).toLocaleTimeString()}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

window.initializeChat = initializeChat;
