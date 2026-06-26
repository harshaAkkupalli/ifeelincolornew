import bcrypt
import jwt
import os
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request

JWT_ALGORITHM = "HS256"

def get_jwt_secret():
    return os.environ.get("JWT_SECRET", "fallback_secret")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_admin_token(admin_id: str, email: str, role: str) -> str:
    payload = {
        "sub": admin_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "admin_access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_admin(request: Request, db) -> dict:
    token = request.cookies.get("admin_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Admin not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "admin_access":
            raise HTTPException(status_code=401, detail="Invalid token")
        admin = await db.admins.find_one({"admin_id": payload["sub"]}, {"_id": 0})
        if not admin:
            raise HTTPException(status_code=401, detail="Admin not found")
        admin.pop("password_hash", None)
        return admin
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_super_admin(request: Request, db) -> dict:
    admin = await get_current_admin(request, db)
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin required")
    return admin

async def seed_admin(db):
    email = os.environ.get("ADMIN_EMAIL", "admin@ifeelincolor.com")
    password = os.environ.get("ADMIN_PASSWORD", "Admin@123!")
    existing = await db.admins.find_one({"email": email}, {"_id": 0})
    if not existing:
        await db.admins.insert_one({
            "admin_id": f"admin_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": "Super Admin",
            "password_hash": hash_password(password),
            "role": "super_admin",
            "permissions": ["all"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(password, existing.get("password_hash", "")):
        await db.admins.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})
