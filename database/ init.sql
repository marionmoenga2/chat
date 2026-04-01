-- Chat System Database Initialization
-- Compatible with SQLite and MySQL (with minor syntax adjustments)

-- Create Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- For SQLite
    -- id INT PRIMARY KEY AUTO_INCREMENT,    -- For MySQL
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    is_admin BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Messages table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- For SQLite
    -- id INT PRIMARY KEY AUTO_INCREMENT,    -- For MySQL
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER,
    room_id INTEGER,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_status BOOLEAN DEFAULT 0,
    message_type VARCHAR(20) DEFAULT 'text',
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create Chat Rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- For SQLite
    -- id INT PRIMARY KEY AUTO_INCREMENT,    -- For MySQL
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create Chat Room Members association table
CREATE TABLE IF NOT EXISTS chat_room_members (
    user_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, room_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert default admin user (password: admin123)
-- Note: In production, use proper password hashing via the application
-- This is a bcrypt hash of 'admin123' for demonstration
INSERT OR IGNORE INTO users (id, username, email, password_hash, is_admin, is_active) 
VALUES (
    1, 
    'admin', 
    'admin@chatapp.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G',  -- admin123
    1, 
    1
);

-- Insert sample users for testing (passwords: user123)
INSERT OR IGNORE INTO users (username, email, password_hash, is_active) VALUES 
('alice', 'alice@example.com', '$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 1),
('bob', 'bob@example.com', '$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 1),
('charlie', 'charlie@example.com', '$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 1);

-- Insert sample chat room
INSERT OR IGNORE INTO chat_rooms (id, name, description, created_by) 
VALUES (1, 'General', 'General discussion room', 1);

-- Add admin and users to general room
INSERT OR IGNORE INTO chat_room_members (user_id, room_id) VALUES 
(1, 1), (2, 1), (3, 1), (4, 1);

-- Insert sample messages
INSERT OR IGNORE INTO messages (sender_id, receiver_id, content, timestamp, read_status) VALUES 
(2, 3, 'Hey Bob! How are you?', datetime('now', '-1 hour'), 1),
(3, 2, 'Hi Alice! I am good, thanks!', datetime('now', '-55 minutes'), 1),
(2, 3, 'Great to hear! Want to join the group chat?', datetime('now', '-50 minutes'), 1),
(3, 2, 'Sure, send me the link!', datetime('now', '-45 minutes'), 0),
(1, NULL, 1, 'Welcome everyone to the General chat room!', datetime('now', '-2 hours'), 1),
(2, NULL, 1, 'Thanks for having us!', datetime('now', '-1 hour'), 1);