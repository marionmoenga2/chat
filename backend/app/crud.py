"""
CRUD (Create, Read, Update, Delete) operations for database models.
Contains all database interaction functions.
"""

from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from typing import List, Optional
from datetime import datetime
from . import models, schemas
from .auth import get_password_hash

# User CRUD operations
def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    """Get user by username."""
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    """Get user by email."""
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    """Get user by ID."""
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    """Create new user with hashed password."""
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_last_seen(db: Session, user_id: int):
    """Update user's last seen timestamp."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.last_seen = datetime.utcnow()
        db.commit()

def get_all_users(db: Session, skip: int = 0, limit: int = 100) -> List[models.User]:
    """Get all users with pagination."""
    return db.query(models.User).offset(skip).limit(limit).all()

def ban_user(db: Session, user_id: int) -> bool:
    """Ban/deactivate a user."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.is_active = False
        db.commit()
        return True
    return False

def delete_user(db: Session, user_id: int) -> bool:
    """Delete a user permanently."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        db.delete(user)
        db.commit()
        return True
    return False

# Message CRUD operations
def create_message(db: Session, message: schemas.MessageCreate, sender_id: int) -> models.Message:
    """Create new message."""
    db_message = models.Message(
        sender_id=sender_id,
        receiver_id=message.receiver_id,
        room_id=message.room_id,
        content=message.content,
        message_type="text"
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_messages_between_users(
    db: Session, 
    user1_id: int, 
    user2_id: int, 
    skip: int = 0, 
    limit: int = 50
) -> List[models.Message]:
    """Get private messages between two users."""
    messages = db.query(models.Message).filter(
        or_(
            and_(models.Message.sender_id == user1_id, models.Message.receiver_id == user2_id),
            and_(models.Message.sender_id == user2_id, models.Message.receiver_id == user1_id)
        )
    ).order_by(desc(models.Message.timestamp)).offset(skip).limit(limit).all()
    return list(reversed(messages))

def get_room_messages(db: Session, room_id: int, skip: int = 0, limit: int = 50) -> List[models.Message]:
    """Get messages from a chat room."""
    messages = db.query(models.Message).filter(
        models.Message.room_id == room_id
    ).order_by(desc(models.Message.timestamp)).offset(skip).limit(limit).all()
    return list(reversed(messages))

def mark_messages_as_read(db: Session, receiver_id: int, sender_id: int):
    """Mark messages from sender to receiver as read."""
    db.query(models.Message).filter(
        and_(
            models.Message.receiver_id == receiver_id,
            models.Message.sender_id == sender_id,
            models.Message.read_status == False
        )
    ).update({"read_status": True})
    db.commit()

def get_unread_count(db: Session, user_id: int) -> int:
    """Get count of unread messages for user."""
    return db.query(models.Message).filter(
        and_(
            models.Message.receiver_id == user_id,
            models.Message.read_status == False
        )
    ).count()

def search_messages(db: Session, query: str, user_id: Optional[int] = None) -> List[models.Message]:
    """Search messages by content."""
    q = db.query(models.Message).filter(models.Message.content.contains(query))
    if user_id:
        q = q.filter(
            or_(
                models.Message.sender_id == user_id,
                models.Message.receiver_id == user_id
            )
        )
    return q.order_by(desc(models.Message.timestamp)).limit(100).all()

# Chat Room CRUD operations
def create_chat_room(db: Session, room: schemas.ChatRoomCreate, creator_id: int) -> models.ChatRoom:
    """Create new chat room."""
    db_room = models.ChatRoom(
        name=room.name,
        description=room.description,
        created_by=creator_id
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    # Add creator as member
    creator = db.query(models.User).filter(models.User.id == creator_id).first()
    db_room.members.append(creator)
    db.commit()
    
    return db_room

def get_chat_room(db: Session, room_id: int) -> Optional[models.ChatRoom]:
    """Get chat room by ID."""
    return db.query(models.ChatRoom).filter(models.ChatRoom.id == room_id).first()

def get_user_chat_rooms(db: Session, user_id: int) -> List[models.ChatRoom]:
    """Get all chat rooms where user is member."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    return user.rooms if user else []

def add_user_to_room(db: Session, room_id: int, user_id: int) -> bool:
    """Add user to chat room."""
    room = get_chat_room(db, room_id)
    user = get_user_by_id(db, user_id)
    if room and user and user not in room.members:
        room.members.append(user)
        db.commit()
        return True
    return False