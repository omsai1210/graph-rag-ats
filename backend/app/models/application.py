from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    full_name: str
    email: str
    phone: str
    branch: str
    graduation_year: int
    cgpa: float
    gender: str
    eligibility_status: str
    shortlist_status: str
    graph_rag_score: Optional[float] = None
    graph_rag_explanation: Optional[str] = None
    resume_path: Optional[str] = None
    applied_at: str


class EligibilityCheckResult(BaseModel):
    eligible: bool
    reason: str = ""
    application_id: Optional[str] = None
    message: str
