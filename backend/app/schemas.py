"""
Pydantic schemas for request/response validation.
Defines data models for API communication.
"""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    last_seen: Optional[datetime]
    
    class Config:
        from_attributes = True

class UserStatus(BaseModel):
    id: int
    username: str
    is_online: bool
    last_seen: datetime

# Message Schemas
class MessageBase(BaseModel):
    content: str
    receiver_id: Optional[int] = None
    room_id: Optional[int] = None

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    sender_id: int
    timestamp: datetime
    read_status: bool
    message_type: str
    sender_username: str
    
    class Config:
        from_attributes = True

# Chat Room Schemas
class ChatRoomBase(BaseModel):
    name: str
    description: Optional[str] = None

class ChatRoomCreate(ChatRoomBase):
    pass

class ChatRoomResponse(ChatRoomBase):
    id: int
    created_by: int
    created_at: datetime
    member_count: int
    
    class Config:
        from_attributes = True

# Token Schema
class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# WebSocket Message Schema
class WebSocketMessage(BaseModel):
    type: str  # message, typing, status, notification
    data: dict
    timestamp: Optional[datetime] = None

# Admin Schemas
class AdminUserResponse(UserResponse):
    is_admin: bool

class AdminMessageResponse(MessageResponse):
    sender_email: str
    receiver_email: Optional[str]

class UserBanRequest(BaseModel):
    user_id: int
    reason: Optional[str] = None