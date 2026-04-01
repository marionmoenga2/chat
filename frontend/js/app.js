/**
 * Main Application Module
 * Initializes the application and handles global functionality
 */

// Global configuration
const APP_CONFIG = {
    messageRefreshInterval: 30000, // 30 seconds
    typingTimeout: 2000,
    maxReconnectAttempts: 5
};

/**
 * Initialize application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Chat Application Initialized');
    console.log('API Base URL:', API_BASE_URL);
    console.log('WebSocket URL:', WS_BASE_URL);
    
    // Check for existing session
    checkExistingSession();
    
    // Setup global event listeners
    setupGlobalEvents();
});

/**
 * Check for existing user session
 */
function checkExistingSession() {
    const token = getToken();
    const user = getCurrentUser();
    
    if (token && user) {
        // Validate token with server
        validateAndRestoreSession(token, user);
    }
}

/**
 * Validate token and restore session
 */
async function validateAndRestoreSession(token, user) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const freshUser = await response.json();
            localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
            showChatView(freshUser);
            console.log('Session restored for user:', freshUser.username);
        } else {
            // Token expired or invalid
            clearSession();
            console.log('Session expired, please login again');
        }
    } catch (error) {
        console.error('Session validation error:', error);
        // Don't clear session on network error, allow retry
    }
}

/**
 * Setup global event listeners
 */
function setupGlobalEvents() {
    // Handle online/offline status
    window.addEventListener('online', () => {
        showNotification('Back online', 'success');
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connectWebSocket();
        }
    });
    
    window.addEventListener('offline', () => {
        showNotification('You are offline', 'warning');
    });
    
    // Handle visibility change (tab switch)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && currentChat) {
            // Refresh messages when tab becomes visible
            refreshMessages();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
                modal.classList.add('hidden');
            });
        }
        
        // Ctrl/Cmd + / to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            const searchInput = document.querySelector('.search-box input');
            if (searchInput) searchInput.focus();
        }
    });
    
    // Handle before unload
    window.addEventListener('beforeunload', (e) => {
        // Close WebSocket gracefully
        if (ws) {
            ws.close(1000, 'Page closing');
        }
    });
}

/**
 * Clear user session
 */
function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    // Reset UI to login
    document.getElementById('auth-view').classList.add('active');
    document.getElementById('chat-view').classList.remove('active');
}

/**
 * Toggle emoji picker (placeholder for future implementation)
 */
function toggleEmojiPicker() {
    showNotification('Emoji picker coming soon!', 'info');
}

/**
 * Get unread message count for all conversations
 */
async function getTotalUnreadCount() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/messages/unread/count`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.unread_count;
        }
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

/**
 * Update browser title with unread count
 */
function updateTitleWithUnread(count) {
    const baseTitle = 'ChatApp';
    if (count > 0) {
        document.title = `(${count}) ${baseTitle}`;
    } else {
        document.title = baseTitle;
    }
}

/**
 * Request notification permission
 */
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/**
 * Show browser notification
 */
function showBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/favicon.ico'
        });
    }
}

/**
 * Debounce function for performance
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for performance
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Make functions globally accessible
window.APP_CONFIG = APP_CONFIG;
window.clearSession = clearSession;
window.toggleEmojiPicker = toggleEmojiPicker;
window.getTotalUnreadCount = getTotalUnreadCount;
window.updateTitleWithUnread = updateTitleWithUnread;
window.requestNotificationPermission = requestNotificationPermission;
window.showBrowserNotification = showBrowserNotification;
window.debounce = debounce;
window.throttle = throttle;