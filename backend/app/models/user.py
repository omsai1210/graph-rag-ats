from typing import Literal

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Literal["recruiter", "candidate"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: str


class AuthResponse(BaseModel):
    access_token: str
    user: UserProfile
