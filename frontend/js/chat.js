/**
 * Chat Module
 * Handles real-time messaging, WebSocket connection, and UI updates
 */

// Global state
let ws = null;
let currentChat = null; // { type: 'user'|'room', id: number, name: string }
let users = [];
let rooms = [];
let typingTimeout = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Initialize chat functionality
 */
function initChat() {
    connectWebSocket();
    loadUsers();
    loadRooms();
    setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Window resize for responsive sidebar
    window.addEventListener('resize', handleResize);
    
    // Before unload - update last seen
    window.addEventListener('beforeunload', () => {
        if (ws) ws.close();
    });
}

/**
 * Connect to WebSocket server
 */
function connectWebSocket() {
    const token = getToken();
    if (!token) return;
    
    const wsUrl = `ws://localhost:8000/ws?token=${token}`;
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            reconnectAttempts = 0;
            showNotification('Connected to chat server', 'success');
        };
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connectWebSocket, 3000 * reconnectAttempts);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        // Store globally for access from other functions
        window.chatWebSocket = ws;
        
    } catch (error) {
        console.error('WebSocket connection error:', error);
    }
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'message':
            handleNewMessage(message.data);
            break;
        case 'typing':
            handleTypingIndicator(message.data);
            break;
        case 'status':
            handleUserStatus(message.data);
            break;
        case 'notification':
            showNotification(message.data.message, 'info');
            break;
        case 'read_receipt':
            handleReadReceipt(message.data);
            break;
        case 'pong':
            // Heartbeat response, ignore
            break;
    }
}

/**
 * Handle new incoming message
 */
function handleNewMessage(data) {
    // Check if message belongs to current chat
    const isCurrentChat = currentChat && (
        (currentChat.type === 'user' && 
         ((data.sender_id === currentChat.id && data.receiver_id === getCurrentUser().id) ||
          (data.sender_id === getCurrentUser().id && data.receiver_id === currentChat.id))) ||
        (currentChat.type === 'room' && data.room_id === currentChat.id)
    );
    
    if (isCurrentChat) {
        displayMessage(data);
        scrollToBottom();
        
        // Send read receipt if we're the receiver
        if (data.receiver_id === getCurrentUser().id && !data.read_status) {
            sendReadReceipt(data.sender_id);
        }
    } else {
        // Show notification for message not in current chat
        if (data.sender_id !== getCurrentUser().id) {
            showNotification(`New message from ${data.sender_username}`, 'info');
            updateUnreadCount(data.sender_id);
        }
    }
}

/**
 * Handle typing indicator
 */
function handleTypingIndicator(data) {
    if (!currentChat) return;
    
    const isRelevant = (currentChat.type === 'user' && data.user_id === currentChat.id) ||
                       (currentChat.type === 'room' && data.room_id === currentChat.id && data.user_id !== getCurrentUser().id);
    
    if (isRelevant) {
        const indicator = document.getElementById('typing-indicator');
        if (data.is_typing) {
            indicator.querySelector('span').textContent = `${data.username} is typing`;
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }
}

/**
 * Handle user online/offline status
 */
function handleUserStatus(data) {
    // Update user in list
    const userIndex = users.findIndex(u => u.id === data.user_id);
    if (userIndex !== -1) {
        users[userIndex].is_online = data.is_online;
        users[userIndex].last_seen = data.timestamp;
        renderUsersList();
    }
    
    // Update chat header if chatting with this user
    if (currentChat && currentChat.type === 'user' && currentChat.id === data.user_id) {
        updateChatHeaderStatus(data.is_online);
    }
}

/**
 * Handle read receipt
 */
function handleReadReceipt(data) {
    // Update message status indicators in UI
    const messages = document.querySelectorAll('.message.own');
    messages.forEach(msg => {
        const statusEl = msg.querySelector('.message-status');
        if (statusEl) {
            statusEl.innerHTML = '<i class="fas fa-check-double"></i>';
        }
    });
}

/**
 * Load users list from API
 */
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (response.ok) {
            users = await response.json();
            renderUsersList();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

/**
 * Load chat rooms from API
 */
async function loadRooms() {
    try {
        const response = await fetch(`${API_BASE_URL}/rooms`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (response.ok) {
            rooms = await response.json();
            renderRoomsList();
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
    }
}

/**
 * Render users list in sidebar
 */
function renderUsersList() {
    const container = document.getElementById('users-list');
    container.innerHTML = '';
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = `user-item ${currentChat?.type === 'user' && currentChat.id === user.id ? 'active' : ''}`;
        div.onclick = () => selectUser(user);
        
        const lastSeen = formatLastSeen(user.last_seen);
        const statusClass = user.is_online ? 'online' : 'offline';
        
        div.innerHTML = `
            <div class="avatar">
                ${user.username.charAt(0).toUpperCase()}
                <div class="status-dot ${statusClass}"></div>
            </div>
            <div class="user-info-text">
                <h4>${user.username}</h4>
                <span>${user.is_online ? 'Online' : lastSeen}</span>
            </div>
            ${user.unread_count ? `<div class="unread-badge">${user.unread_count}</div>` : ''}
        `;
        
        container.appendChild(div);
    });
}

/**
 * Render rooms list in sidebar
 */
function renderRoomsList() {
    const container = document.getElementById('rooms-list');
    container.innerHTML = '';
    
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = `room-item ${currentChat?.type === 'room' && currentChat.id === room.id ? 'active' : ''}`;
        div.onclick = () => selectRoom(room);
        
        div.innerHTML = `
            <div class="avatar">
                <i class="fas fa-hashtag"></i>
            </div>
            <div class="room-info">
                <h4>${room.name}</h4>
                <span>${room.member_count} members</span>
            </div>
        `;
        
        container.appendChild(div);
    });
}

/**
 * Select user to chat with
 */
async function selectUser(user) {
    currentChat = { type: 'user', id: user.id, name: user.username };
    
    // Update UI
    document.querySelectorAll('.user-item, .room-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Update header
    updateChatHeader(user.username, user.is_online ? 'Online' : formatLastSeen(user.last_seen));
    
    // Load messages
    await loadMessages(user.id);
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

/**
 * Select room to chat in
 */
async function selectRoom(room) {
    currentChat = { type: 'room', id: room.id, name: room.name };
    
    // Update UI
    document.querySelectorAll('.user-item, .room-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Update header
    updateChatHeader(room.name, `${room.member_count} members`);
    
    // Load messages
    await loadRoomMessages(room.id);
    
    // Join room via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'join_room',
            room_id: room.id
        }));
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

/**
 * Load messages between current user and selected user
 */
async function loadMessages(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${userId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (response.ok) {
            const messages = await response.json();
            displayMessages(messages);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

/**
 * Load messages from a room
 */
async function loadRoomMessages(roomId) {
    try {
        const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/messages`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (response.ok) {
            const messages = await response.json();
            displayMessages(messages);
        }
    } catch (error) {
        console.error('Error loading room messages:', error);
    }
}

/**
 * Display array of messages
 */
function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    
    messages.forEach(msg => displayMessage(msg));
    scrollToBottom();
}

/**
 * Display single message
 */
function displayMessage(msg) {
    const container = document.getElementById('messages-container');
    const currentUserId = getCurrentUser().id;
    const isOwn = msg.sender_id === currentUserId;
    
    // Remove welcome message if present
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : 'other'}`;
    div.dataset.messageId = msg.id;
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    div.innerHTML = `
        <div class="message-bubble">${escapeHtml(msg.content)}</div>
        <div class="message-meta">
            <span>${msg.sender_username}</span>
            <span>${time}</span>
            ${isOwn ? `<span class="message-status">${msg.read_status ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>'}</span>` : ''}
        </div>
    `;
    
    container.appendChild(div);
}

/**
 * Send message
 */
function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content || !currentChat) return;
    
    const messageData = {
        type: 'message',
        content: content,
        receiver_id: currentChat.type === 'user' ? currentChat.id : null,
        room_id: currentChat.type === 'room' ? currentChat.id : null
    };
    
    // Send via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(messageData));
        input.value = '';
        
        // Stop typing indicator
        sendTypingStatus(false);
    } else {
        // Fallback to REST API
        sendMessageREST(content);
    }
}

/**
 * Send message via REST API (fallback)
 */
async function sendMessageREST(content) {
    try {
        const response = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content,
                receiver_id: currentChat.type === 'user' ? currentChat.id : null,
                room_id: currentChat.type === 'room' ? currentChat.id : null
            })
        });
        
        if (response.ok) {
            const msg = await response.json();
            displayMessage(msg);
            scrollToBottom();
            document.getElementById('message-input').value = '';
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Failed to send message', 'error');
    }
}

/**
 * Handle input keypress
 */
function handleInputKeypress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

/**
 * Handle typing indicator
 */
function handleTyping() {
    if (!currentChat) return;
    
    // Send typing start
    sendTypingStatus(true);
    
    // Clear existing timeout
    if (typingTimeout) clearTimeout(typingTimeout);
    
    // Send typing stop after 2 seconds of inactivity
    typingTimeout = setTimeout(() => {
        sendTypingStatus(false);
    }, 2000);
}

/**
 * Send typing status
 */
function sendTypingStatus(isTyping) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
        type: 'typing',
        is_typing: isTyping,
        receiver_id: currentChat.type === 'user' ? currentChat.id : null,
        room_id: currentChat.type === 'room' ? currentChat.id : null
    }));
}

/**
 * Send read receipt
 */
function sendReadReceipt(senderId) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
        type: 'read_receipt',
        sender_id: senderId
    }));
}

/**
 * Update chat header
 */
function updateChatHeader(name, status) {
    const header = document.getElementById('chat-header-info');
    header.innerHTML = `
        <div class="avatar">
            <span>${name.charAt(0).toUpperCase()}</span>
        </div>
        <div class="partner-info">
            <h3>${name}</h3>
            <span class="status-text">${status}</span>
        </div>
    `;
}

/**
 * Update chat header status
 */
function updateChatHeaderStatus(isOnline) {
    const statusEl = document.querySelector('.partner-info .status-text');
    if (statusEl) {
        statusEl.textContent = isOnline ? 'Online' : 'Offline';
    }
}

/**
 * Switch sidebar tab
 */
function switchTab(tab) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}-tab`).classList.add('active');
}

/**
 * Toggle sidebar (mobile)
 */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

/**
 * Search users
 */
function searchUsers(query) {
    const items = document.querySelectorAll('.user-item');
    const lowerQuery = query.toLowerCase();
    
    items.forEach(item => {
        const name = item.querySelector('h4').textContent.toLowerCase();
        item.style.display = name.includes(lowerQuery) ? 'flex' : 'none';
    });
}

/**
 * Show create room modal
 */
function showCreateRoom() {
    document.getElementById('create-room-modal').classList.remove('hidden');
}

/**
 * Close modal
 */
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

/**
 * Create new room
 */
async function createRoom() {
    const name = document.getElementById('room-name').value.trim();
    const description = document.getElementById('room-desc').value.trim();
    
    if (!name) {
        showNotification('Please enter a room name', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });
        
        if (response.ok) {
            const room = await response.json();
            rooms.push(room);
            renderRoomsList();
            closeModal('create-room-modal');
            
            // Clear inputs
            document.getElementById('room-name').value = '';
            document.getElementById('room-desc').value = '';
            
            showNotification('Room created successfully', 'success');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        showNotification('Failed to create room', 'error');
    }
}

/**
 * Refresh messages
 */
async function refreshMessages() {
    if (!currentChat) return;
    
    if (currentChat.type === 'user') {
        await loadMessages(currentChat.id);
    } else {
        await loadRoomMessages(currentChat.id);
    }
}

/**
 * Scroll messages to bottom
 */
function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

/**
 * Format last seen time
 */
function formatLastSeen(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle window resize
 */
function handleResize() {
    if (window.innerWidth > 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

/**
 * Update unread count badge
 */
function updateUnreadCount(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        user.unread_count = (user.unread_count || 0) + 1;
        renderUsersList();
    }
}