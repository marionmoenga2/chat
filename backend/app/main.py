from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, users, messages, admin

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Chat System API")

# CORS - Allow ALL origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth)
app.include_router(users, prefix="/api/users", tags=["users"])
app.include_router(messages, prefix="/api/messages", tags=["messages"])
app.include_router(admin, prefix="/api/admin", tags=["admin"])

@app.get("/")
async def root():
    return {"message": "Chat System API", "status": "running"}
