from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user


async def require_recruiter(user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency: allow only users whose role is 'recruiter'.
    Raises HTTP 403 otherwise.
    """
    if user.get("role") != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter access required",
        )
    return user


async def require_candidate(user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency: allow only users whose role is 'candidate'.
    Raises HTTP 403 otherwise.
    """
    if user.get("role") != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Candidate access required",
        )
    return user
