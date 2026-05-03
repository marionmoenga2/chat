from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..routers.auth import get_current_user

router = APIRouter()

@router.get("/")
async def get_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "email": u.email} for u in users]

@router.get("/online")
async def get_online_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # For now, return all users as "online"
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username} for u in users if u.id != current_user.id]

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email}
