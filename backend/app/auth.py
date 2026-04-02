"""
Authentication utilities including password hashing and JWT token handling.
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from . import models
from .database import get_db
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, ADMIN_USERNAME, ADMIN_PASSWORD

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme for JWT
security = HTTPBearer()

# ==================== PASSWORD FUNCTIONS ====================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    # FIX: truncate password to 72 bytes (bcrypt limit)
    return pwd_context.verify(plain_password[:72], hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash."""
    # FIX: truncate password to 72 bytes
    return pwd_context.hash(password[:72])

# ==================== TOKEN FUNCTIONS ====================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token."""
    to_encode = data.copy()
    
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# ==================== USER AUTH ====================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """Get current authenticated user."""
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.username == username).first()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is banned or inactive"
        )
    
    return user

# ==================== ADMIN AUTH ====================

async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify current user is admin from token."""
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    if not payload.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return {
        "id": 0,
        "username": payload.get("sub"),
        "is_admin": True
    }

# ==================== WEBSOCKET AUTH ====================

async def get_current_user_ws(token: str, db: Session) -> Optional[models.User]:
    """Get current user from WebSocket token."""
    
    payload = decode_token(token)
    if payload is None:
        return None
    
    username: str = payload.get("sub")
    if username is None:
        return None
    
    user = db.query(models.User).filter(models.User.username == username).first()
    
    if user and user.is_active:
        return user
    
    return None

# ==================== ADMIN LOGIN ====================

def authenticate_admin(username: str, password: str) -> bool:
    """Authenticate admin credentials."""
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD