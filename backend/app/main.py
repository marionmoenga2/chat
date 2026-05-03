from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, users, messages, admin

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Chat System API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (auth is already the router object)
app.include_router(auth)
app.include_router(users, prefix="/api/users", tags=["users"])
app.include_router(messages, prefix="/api/messages", tags=["messages"])
app.include_router(admin, prefix="/api/admin", tags=["admin"])

@app.get("/")
async def root():
    return {"message": "Chat System API", "status": "running"}
