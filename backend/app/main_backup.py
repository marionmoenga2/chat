"""
Main FastAPI application entry point.
Contains all REST API endpoints and WebSocket route.
"""

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import timedelta
from . import models, schemas, crud, auth, websocket
from .database import get_db, init_db
from .config import ALLOWED_ORIGINS, ACCESS_TOKEN_EXPIRE_MINUTES
from .websocket import manager

# Initialize FastAPI app
app = FastAPI(
    title="Chat System API",
    description="Real-time chat system with WebSocket support",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/api/auth/register", response_model=schemas.Token)
async def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Register new user account.
    Returns JWT token for immediate login.
    """
    # Check if username exists
    db_user = crud.get_user_by_username(db, user.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    db_user = crud.get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    new_user = crud.create_user(db, user)
    
    # Generate token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": new_user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user
    }

@app.post("/api/auth/login", response_model=schemas.Token)
async def login(user_data: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    """
    # Find user
    user = crud.get_user_by_username(db, user_data.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Verify password
    if not auth.verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been banned or deactivated"
        )
    
    # Update last seen
    crud.update_user_last_seen(db, user.id)
    
    # Generate token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Get current authenticated user info."""
    return current_user

# ==================== USER ENDPOINTS ====================

@app.get("/api/users", response_model=List[schemas.UserStatus])
async def get_users(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all users with their online status.
    Excludes banned users.
    """
    users = crud.get_all_users(db)
    result = []
    for user in users:
        if user.id != current_user.id and user.is_active:
            is_online = manager.is_user_online(user.id)
            result.append({
                "id": user.id,
                "username": user.username,
                "is_online": is_online,
                "last_seen": user.last_seen
            })
    return result

@app.get("/api/users/online")
async def get_online_users(current_user: models.User = Depends(auth.get_current_user)):
    """Get list of currently online user IDs."""
    return {"online_users": manager.get_online_users()}

# ==================== MESSAGE ENDPOINTS ====================

@app.post("/api/messages", response_model=schemas.MessageResponse)
async def send_message(
    message: schemas.MessageCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a new message (REST API fallback).
    Also broadcasts via WebSocket if user is connected.
    """
    # Verify receiver exists if specified
    if message.receiver_id:
        receiver = crud.get_user_by_id(db, message.receiver_id)
        if not receiver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Receiver not found"
            )
    
    # Create message
    db_message = crud.create_message(db, message, current_user.id)
    
    # Prepare response with sender username
    response = {
        "id": db_message.id,
        "content": db_message.content,
        "sender_id": db_message.sender_id,
        "receiver_id": db_message.receiver_id,
        "room_id": db_message.room_id,
        "timestamp": db_message.timestamp,
        "read_status": db_message.read_status,
        "message_type": db_message.message_type,
        "sender_username": current_user.username
    }
    
    # If receiver is online, broadcast via WebSocket
    if message.receiver_id and manager.is_user_online(message.receiver_id):
        import json
        from .websocket import manager as ws_manager
        ws_msg = {
            "type": "message",
            "data": response
        }
        await ws_manager.send_personal_message(
            json.dumps(ws_msg), 
            message.receiver_id
        )
    
    return response

@app.get("/api/messages/{user_id}", response_model=List[schemas.MessageResponse])
async def get_messages(
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get chat history between current user and specified user.
    """
    messages = crud.get_messages_between_users(db, current_user.id, user_id, skip, limit)
    
    # Add sender_username to each message
    result = []
    for msg in messages:
        sender = crud.get_user_by_id(db, msg.sender_id)
        result.append({
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "room_id": msg.room_id,
            "timestamp": msg.timestamp,
            "read_status": msg.read_status,
            "message_type": msg.message_type,
            "sender_username": sender.username if sender else "Unknown"
        })
    
    # Mark messages as read
    crud.mark_messages_as_read(db, current_user.id, user_id)
    
    return result

@app.get("/api/messages/unread/count")
async def get_unread_count(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get count of unread messages for current user."""
    count = crud.get_unread_count(db, current_user.id)
    return {"unread_count": count}

# ==================== CHAT ROOM ENDPOINTS ====================

@app.post("/api/rooms", response_model=schemas.ChatRoomResponse)
async def create_room(
    room: schemas.ChatRoomCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Create new chat room."""
    db_room = crud.create_chat_room(db, room, current_user.id)
    return {
        "id": db_room.id,
        "name": db_room.name,
        "description": db_room.description,
        "created_by": db_room.created_by,
        "created_at": db_room.created_at,
        "member_count": len(db_room.members)
    }

@app.get("/api/rooms", response_model=List[schemas.ChatRoomResponse])
async def get_my_rooms(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get all chat rooms where current user is member."""
    rooms = crud.get_user_chat_rooms(db, current_user.id)
    return [
        {
            "id": room.id,
            "name": room.name,
            "description": room.description,
            "created_by": room.created_by,
            "created_at": room.created_at,
            "member_count": len(room.members)
        }
        for room in rooms
    ]

@app.get("/api/rooms/{room_id}/messages", response_model=List[schemas.MessageResponse])
async def get_room_messages(
    room_id: int,
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages from a chat room."""
    # Check if user is member
    room = crud.get_chat_room(db, room_id)
    if not room or current_user not in room.members:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this room"
        )
    
    messages = crud.get_room_messages(db, room_id, skip, limit)
    result = []
    for msg in messages:
        sender = crud.get_user_by_id(db, msg.sender_id)
        result.append({
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "room_id": msg.room_id,
            "timestamp": msg.timestamp,
            "read_status": msg.read_status,
            "message_type": msg.message_type,
            "sender_username": sender.username if sender else "Unknown"
        })
    return result

# ==================== WEBSOCKET ENDPOINT ====================

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    """
    WebSocket endpoint for real-time communication.
    Requires token query parameter for authentication.
    """
    from .websocket import handle_websocket; await handle_websocket(websocket, token)

# ==================== ADMIN ENDPOINTS ====================

@app.post("/api/admin/login")
async def admin_login(credentials: schemas.UserLogin):
    """
    Admin login endpoint.
    Separate from regular user authentication.
    """
    if auth.authenticate_admin(credentials.username, credentials.password):
        # Create admin token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth.create_access_token(
            data={"sub": credentials.username, "is_admin": True},
            expires_delta=access_token_expires
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "is_admin": True
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid admin credentials"
    )

@app.get("/api/admin/users", response_model=List[schemas.AdminUserResponse])
async def admin_get_users(
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """Get all users including banned ones (admin only)."""
    users = crud.get_all_users(db, skip, limit)
    return users

@app.post("/api/admin/users/{user_id}/ban")
async def admin_ban_user(
    user_id: int,
    request: schemas.UserBanRequest,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Ban/deactivate a user (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot ban yourself"
        )
    
    success = crud.ban_user(db, user_id)
    if success:
        # Disconnect user if online
        if manager.is_user_online(user_id):
            # Force disconnect will happen on next message attempt
            pass
        return {"message": "User banned successfully"}
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found"
    )

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Permanently delete a user (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    success = crud.delete_user(db, user_id)
    if success:
        return {"message": "User deleted successfully"}
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found"
    )

@app.get("/api/admin/messages", response_model=List[schemas.AdminMessageResponse])
async def admin_get_messages(
    query: Optional[str] = None,
    user_id: Optional[int] = None,
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all messages with optional search and filter (admin only).
    """
    if query:
        messages = crud.search_messages(db, query, user_id)
    else:
        from sqlalchemy import desc
        messages = db.query(models.Message).order_by(
            desc(models.Message.timestamp)
        ).offset(skip).limit(limit).all()
    
    result = []
    for msg in messages:
        sender = crud.get_user_by_id(db, msg.sender_id)
        receiver = crud.get_user_by_id(db, msg.receiver_id) if msg.receiver_id else None
        result.append({
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "sender_email": sender.email if sender else "Unknown",
            "receiver_id": msg.receiver_id,
            "receiver_email": receiver.email if receiver else None,
            "room_id": msg.room_id,
            "timestamp": msg.timestamp,
            "read_status": msg.read_status,
            "message_type": msg.message_type,
            "sender_username": sender.username if sender else "Unknown"
        })
    
    return result

@app.get("/api/admin/stats")
async def admin_get_stats(
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db)
):
    """Get system statistics (admin only)."""
    total_users = db.query(models.User).count()
    total_messages = db.query(models.Message).count()
    active_users = db.query(models.User).filter(models.User.is_active == True).count()
    online_users = len(manager.get_online_users())
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "banned_users": total_users - active_users,
        "total_messages": total_messages,
        "online_now": online_users
    }

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """API health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)