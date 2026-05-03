// Chat Application JavaScript

function initializeChat() {
    console.log('Chat initialized');
    
    const currentUser = getCurrentUser();
    if (currentUser) {
        document.getElementById('currentUsername').textContent = currentUser.username;
    }
    
    // Load online users
    loadOnlineUsers();
    
    // Setup event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    document.getElementById('messageInput').addEventListener('input', updateCharCounter);
}

async function loadOnlineUsers() {
    try {
        const response = await apiCall('/api/users/online');
        if (response.ok) {
            const users = await response.json();
            displayUsers(users);
        }
    } catch (e) {
        console.error('Failed to load users:', e);
    }
}

function displayUsers(users) {
    const list = document.getElementById('onlineUsersList');
    const count = document.getElementById('onlineCount');
    
    list.innerHTML = '';
    count.textContent = users.length;
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="avatar"><i class="fas fa-user"></i></div>
            <span>${user.username}</span>
        `;
        li.addEventListener('click', () => startChat(user));
        list.appendChild(li);
    });
}

function startChat(user) {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('messagesContainer').classList.remove('hidden');
    document.getElementById('partnerName').textContent = user.username;
    document.getElementById('partnerStatus').textContent = 'Online';
}

function updateCharCounter() {
    const input = document.getElementById('messageInput');
    const counter = document.getElementById('charCounter');
    counter.textContent = `${input.value.length}/2000`;
    document.getElementById('sendBtn').disabled = input.value.trim() === '';
}

async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;
    
    // Display message locally
    displayMessage({
        content: content,
        sender: getCurrentUser(),
        timestamp: new Date().toISOString()
    }, true);
    
    input.value = '';
    updateCharCounter();
}

function displayMessage(message, isSent) {
    const container = document.getElementById('messagesContainer');
    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    div.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

window.initializeChat = initializeChat;
