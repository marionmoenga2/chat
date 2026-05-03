from .auth import router as auth
from .users import router as users
from .messages import router as messages
from .admin import router as admin

__all__ = ["auth", "users", "messages", "admin"]
