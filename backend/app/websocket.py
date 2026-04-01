"""
WebSocket manager for real-time communication.
Handles connections, message broadcasting, and online status.
"""

import json
import asyncio
from typing import Dict, List, Set
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from . import crud, schemas
from .auth import get_current_user_ws
from .database import SessionLocal

class ConnectionManager:
    """
    Manages WebSocket connections for real-time chat.
    Tracks online users and handles message routing.
    """
    
    def __init__(self):
        # Map of user_id to WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}
        # Map of room_id to set of user_ids
        self.room_connections: Dict[int, Set[int]] = {}
        # Map of websocket to user_id for reverse lookup
        self.connection_users: Dict[WebSocket, int] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept connection and register user."""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.connection_users[websocket] = user_id
        
        # Update last seen
        db = SessionLocal()
        try:
            crud.update_user_last_seen(db, user_id)
        finally:
            db.close()
        
        # Broadcast user online status
        await self.broadcast_user_status(user_id, True)
    
    def disconnect(self, websocket: WebSocket):
        """Remove connection and cleanup."""
        user_id = self.connection_users.get(websocket)
        if user_id:
            del self.active_connections[user_id]
            del self.connection_users[websocket]
            
            # Remove from all rooms
            for room_id, members in self.room_connections.items():
                members.discard(user_id)
            
            # Broadcast offline status
            asyncio.create_task(self.broadcast_user_status(user_id, False))
    
    async def broadcast_user_status(self, user_id: int, is_online: bool):
        """Broadcast user online/offline status to all connected clients."""
        message = {
            "type": "status",
            "data": {
                "user_id": user_id,
                "is_online": is_online,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        await self.broadcast(json.dumps(message))
    
    async def send_personal_message(self, message: str, user_id: int):
        """Send message to specific user."""
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)
    
    async def broadcast(self, message: str):
        """Broadcast message to all connected users."""
        disconnected = []
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except:
                disconnected.append(user_id)
        
        # Cleanup disconnected clients
        for user_id in disconnected:
            if user_id in self.active_connections:
                del self.active_connections[user_id]
    
    async def broadcast_to_room(self, room_id: int, message: str, exclude_user: int = None):
        """Broadcast message to all members of a room."""
        if room_id in self.room_connections:
            for user_id in self.room_connections[room_id]:
                if user_id != exclude_user and user_id in self.active_connections:
                    try:
                        await self.active_connections[user_id].send_text(message)
                    except:
                        pass
    
    def join_room(self, user_id: int, room_id: int):
        """Add user to room's active connections."""
        if room_id not in self.room_connections:
            self.room_connections[room_id] = set()
        self.room_connections[room_id].add(user_id)
    
    def leave_room(self, user_id: int, room_id: int):
        """Remove user from room's active connections."""
        if room_id in self.room_connections:
            self.room_connections[room_id].discard(user_id)
    
    def is_user_online(self, user_id: int) -> bool:
        """Check if user is currently connected."""
        return user_id in self.active_connections
    
    def get_online_users(self) -> List[int]:
        """Get list of online user IDs."""
        return list(self.active_connections.keys())

# Global connection manager instance
manager = ConnectionManager()

async def handle_websocket(websocket: WebSocket, token: str):
    """
    Main WebSocket handler.
    Manages authentication and message routing.
    """
    # Verify token
    db = SessionLocal()
    try:
        user = await get_current_user_ws(token, db)
        if not user:
            await websocket.close(code=4001, reason="Invalid authentication")
            return
        
        # Connect user
        await manager.connect(websocket, user.id)
        
        try:
            while True:
                # Receive message
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                await process_message(websocket, message_data, user, db)
                
        except WebSocketDisconnect:
            manager.disconnect(websocket)
            
    except Exception as e:
        await websocket.close(code=4000, reason=str(e))
    finally:
        db.close()

async def process_message(websocket: WebSocket, data: dict, user, db: Session):
    """
    Process incoming WebSocket message.
    Handles different message types: chat, typing, join_room, etc.
    """
    msg_type = data.get("type")
    
    if msg_type == "message":
        # Handle chat message
        content = data.get("content", "").strip()
        receiver_id = data.get("receiver_id")
        room_id = data.get("room_id")
        
        if not content:
            return
        
        # Save to database
        msg_create = schemas.MessageCreate(
            content=content,
            receiver_id=receiver_id,
            room_id=room_id
        )
        message = crud.create_message(db, msg_create, user.id)
        
        # Prepare broadcast message
        broadcast_msg = {
            "type": "message",
            "data": {
                "id": message.id,
                "content": message.content,
                "sender_id": message.sender_id,
                "sender_username": user.username,
                "receiver_id": message.receiver_id,
                "room_id": message.room_id,
                "timestamp": message.timestamp.isoformat(),
                "read_status": message.read_status
            }
        }
        
        # Send to receiver if private message
        if receiver_id and receiver_id != user.id:
            await manager.send_personal_message(json.dumps(broadcast_msg), receiver_id)
            # Send back to sender for confirmation
            await manager.send_personal_message(json.dumps(broadcast_msg), user.id)
        elif room_id:
            # Broadcast to room
            await manager.broadcast_to_room(room_id, json.dumps(broadcast_msg))
        else:
            # Broadcast to all (public message)
            await manager.broadcast(json.dumps(broadcast_msg))
    
    elif msg_type == "typing":
        # Handle typing indicator
        receiver_id = data.get("receiver_id")
        room_id = data.get("room_id")
        is_typing = data.get("is_typing", False)
        
        typing_msg = {
            "type": "typing",
            "data": {
                "user_id": user.id,
                "username": user.username,
                "is_typing": is_typing,
                "receiver_id": receiver_id,
                "room_id": room_id
            }
        }
        
        if receiver_id:
            await manager.send_personal_message(json.dumps(typing_msg), receiver_id)
        elif room_id:
            await manager.broadcast_to_room(room_id, json.dumps(typing_msg), exclude_user=user.id)
    
    elif msg_type == "join_room":
        # Join a chat room
        room_id = data.get("room_id")
        if room_id:
            manager.join_room(user.id, room_id)
            # Notify room members
            join_msg = {
                "type": "notification",
                "data": {
                    "message": f"{user.username} joined the room",
                    "room_id": room_id,
                    "user_id": user.id
                }
            }
            await manager.broadcast_to_room(room_id, json.dumps(join_msg))
    
    elif msg_type == "leave_room":
        # Leave a chat room
        room_id = data.get("room_id")
        if room_id:
            manager.leave_room(user.id, room_id)
    
    elif msg_type == "read_receipt":
        # Mark messages as read
        sender_id = data.get("sender_id")
        if sender_id:
            crud.mark_messages_as_read(db, user.id, sender_id)
            # Notify sender that messages were read
            receipt_msg = {
                "type": "read_receipt",
                "data": {
                    "reader_id": user.id,
                    "reader_username": user.username,
                    "sender_id": sender_id
                }
            }
            await manager.send_personal_message(json.dumps(receipt_msg), sender_id)
    
    elif msg_type == "ping":
        # Keep connection alive
        await websocket.send_text(json.dumps({"type": "pong"}))