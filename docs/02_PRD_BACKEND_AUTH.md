# PRD — Module 1: Backend Scaffold + Authentication
**File:** `02_PRD_BACKEND_AUTH.md`  
**Branch:** `feature/backend-setup` then `feature/auth`

---

## Overview

Set up the FastAPI application shell and wire Supabase Auth for two user roles: **recruiter** and **candidate**. All subsequent modules depend on this being correct.

---

## 1. `backend/main.py`

Entry point for the FastAPI app. Registers all routers, sets up CORS for Stitch frontend, and mounts WebSocket routes.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, jobs, applications, shortlist, websocket
from app.core.config import settings

app = FastAPI(title="Graph RAG ATS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production to Stitch domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(shortlist.router, prefix="/shortlist", tags=["shortlist"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])

@app.get("/health")
def health():
    return {"status": "ok"}
```

---

## 2. `backend/app/core/config.py`

Reads all environment variables via pydantic-settings. Every other file imports from here — never read `.env` directly elsewhere.

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str
    redis_url: str
    gemini_api_key: str
    resend_api_key: str
    resend_from_email: str
    secret_key: str
    environment: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 3. `backend/app/core/security.py`

JWT creation and verification. Supabase Auth handles login but we issue our own JWT for role-based access in FastAPI route guards.

**Functions to implement:**
- `create_access_token(data: dict) -> str` — signs JWT with SECRET_KEY, 24h expiry
- `decode_token(token: str) -> dict` — verifies and decodes JWT
- `get_current_user(token) -> UserProfile` — FastAPI dependency, raises 401 if invalid
- `require_recruiter(user) -> UserProfile` — raises 403 if user.role != 'recruiter'
- `require_candidate(user) -> UserProfile` — raises 403 if user.role != 'candidate'

---

## 4. `backend/app/api/routes/auth.py`

### POST `/auth/register`

**Request body:**
```json
{
  "email": "hr@company.com",
  "password": "SecurePass123",
  "full_name": "Priya Sharma",
  "role": "recruiter"   // or "candidate"
}
```

**Logic:**
1. Call Supabase Auth `sign_up(email, password)`
2. Insert row into `public.profiles` with `id = supabase_user.id`, `role`, `full_name`
3. Return access token + user profile

**Response:**
```json
{
  "access_token": "eyJ...",
  "user": { "id": "uuid", "email": "...", "role": "recruiter", "full_name": "..." }
}
```

### POST `/auth/login`

**Request body:**
```json
{
  "email": "hr@company.com",
  "password": "SecurePass123"
}
```

**Logic:**
1. Call Supabase Auth `sign_in_with_password(email, password)`
2. Fetch profile from `public.profiles`
3. Issue our JWT with `{ sub: user_id, role: profile.role }`
4. Return token + profile

**Error cases:**
- Wrong credentials → 401 `{ "detail": "Invalid email or password" }`
- Unverified email → 403

### GET `/auth/me`

**Auth:** Bearer token required  
**Returns:** Current user's profile from `public.profiles`

---

## 5. `backend/app/services/supabase.py`

Singleton Supabase clients. Two clients needed:
- `supabase_client` — uses ANON key (for user-scoped operations)
- `supabase_admin` — uses SERVICE_ROLE key (for backend-only operations like reading all applications)

```python
from supabase import create_client
from app.core.config import settings

supabase_client = create_client(settings.supabase_url, settings.supabase_anon_key)
supabase_admin = create_client(settings.supabase_url, settings.supabase_service_role_key)
```

---

## 6. Pydantic Models — `backend/app/models/user.py`

```python
from pydantic import BaseModel, EmailStr
from typing import Literal
import uuid

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Literal["recruiter", "candidate"]

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: Literal["recruiter", "candidate"]
```

---

## 7. Run locally

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` to see auto-generated Swagger UI.

---

## 8. Tests to write (`backend/tests/test_auth.py`)

- Register recruiter → 200, token returned
- Register candidate → 200, token returned
- Register duplicate email → 400
- Login correct credentials → 200, token valid
- Login wrong password → 401
- GET /me with valid token → 200, profile returned
- GET /me with invalid token → 401

---

## 9. Antigravity Prompts for This Module

**Prompt 1 — Scaffold:**
```
Create a FastAPI application in backend/main.py with CORS enabled for all origins.
Register these routers with prefixes: /auth, /jobs, /applications, /shortlist, /ws.
Add a GET /health endpoint returning {"status": "ok"}.
Use the folder structure: backend/app/api/routes/, backend/app/core/, backend/app/services/.
```

**Prompt 2 — Config:**
```
Create backend/app/core/config.py using pydantic-settings BaseSettings.
Load these env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, REDIS_URL, GEMINI_API_KEY,
RESEND_API_KEY, RESEND_FROM_EMAIL, SECRET_KEY, ENVIRONMENT.
Export a singleton called `settings`.
```

**Prompt 3 — Auth routes:**
```
Create backend/app/api/routes/auth.py with FastAPI router.
Implement POST /register: accept email, password, full_name, role (recruiter|candidate).
Call Supabase sign_up, then insert into public.profiles table using supabase_admin client.
Return a JWT signed with SECRET_KEY containing sub (user_id) and role.

Implement POST /login: call Supabase sign_in_with_password, fetch profile, return JWT.

Implement GET /me: decode Bearer token, return profile from public.profiles.

Use python-jose for JWT, passlib for password hashing check.
Import supabase_admin from app.services.supabase and settings from app.core.config.
```
