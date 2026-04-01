from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import timedelta, datetime
from . import models, schemas, crud, auth, websocket
from .database import get_db, init_db
from .config import ACCESS_TOKEN_EXPIRE_MINUTES
from .websocket import manager

app = FastAPI(
    title="Chat System API",
    description="Real-time chat system with WebSocket support",
    version="1.0.0"
)

# CORS - MUST BE FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()

# ... [include all your routes here] ...

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
