from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Eligibility sub-model (stored in public.job_eligibility)
# ---------------------------------------------------------------------------

class EligibilityFilter(BaseModel):
    gender_allowed: List[str] = ["male", "female", "other"]
    branches_allowed: Optional[List[str]] = None   # None means all branches allowed
    min_cgpa: Optional[float] = None
    graduation_years: Optional[List[int]] = None


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class JobCreateRequest(BaseModel):
    title: str
    description: str
    requirements: Dict[str, Any]          # e.g. {"skills": ["Python"], "experience": "2 years"}
    esco_occupation_code: Optional[str] = None
    max_applicants: int = 100
    deadline: Optional[datetime] = None
    eligibility: EligibilityFilter


class JobUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[Dict[str, Any]] = None
    esco_occupation_code: Optional[str] = None
    max_applicants: Optional[int] = None
    deadline: Optional[datetime] = None
    is_active: Optional[bool] = None
    eligibility: Optional[EligibilityFilter] = None


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class JobResponse(BaseModel):
    id: str
    title: str
    description: str
    requirements: Dict[str, Any]
    esco_occupation_code: Optional[str]
    max_applicants: int
    deadline: Optional[str]
    is_active: bool
    recruiter_id: str
    applicant_count: int = 0
    created_at: str
