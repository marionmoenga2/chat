from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db
from .routers import auth, users, messages, admin

# Initialize database tables
init_db()

app = FastAPI(title="Chat System API")

# CORS - Allow ALL origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
