from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import create_access_token, get_current_user
from app.models.user import AuthResponse, LoginRequest, RegisterRequest, UserProfile
from app.services.supabase import admin_auth, supabase_admin, supabase_client

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------
@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """
    Create a new Supabase auth user (email pre-confirmed),
    insert a profile row, and return a signed JWT.
    """
    try:
        # 1. Create auth user via direct Admin API (avoids supabase-py URL bug)
        auth_resp = admin_auth.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    user = auth_resp.user
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User creation failed – no user object returned",
        )

    try:
        # 2. Insert profile row into public.profiles
        supabase_admin.table("profiles").insert(
            {
                "id": str(user.id),
                "email": body.email,
                "full_name": body.full_name,
                "role": body.role,
            }
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    # 3. Sign and return JWT
    token = create_access_token({"sub": str(user.id), "role": body.role})

    return AuthResponse(
        access_token=token,
        user=UserProfile(
            id=str(user.id),
            email=body.email,
            full_name=body.full_name,
            role=body.role,
        ),
    )


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------
@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """
    Sign in with email + password, fetch the profile, and return a signed JWT.
    """
    try:
        auth_resp = supabase_client.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        )

    user = auth_resp.user if auth_resp else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    try:
        profile_resp = (
            supabase_admin.table("profiles")
            .select("*")
            .eq("id", str(user.id))
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    profile = profile_resp.data
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
        )

    token = create_access_token({"sub": str(user.id), "role": profile["role"]})

    return AuthResponse(
        access_token=token,
        user=UserProfile(
            id=str(user.id),
            email=profile["email"],
            full_name=profile["full_name"],
            role=profile["role"],
        ),
    )


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserProfile)
async def me(current_user: dict = Depends(get_current_user)):
    """
    Return the authenticated user's profile using the Bearer token.
    """
    try:
        profile_resp = (
            supabase_admin.table("profiles")
            .select("*")
            .eq("id", current_user["sub"])
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    profile = profile_resp.data
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
        )

    return UserProfile(
        id=profile["id"],
        email=profile["email"],
        full_name=profile["full_name"],
        role=profile["role"],
    )
