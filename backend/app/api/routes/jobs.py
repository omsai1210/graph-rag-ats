"""
Job routes: CRUD for job postings + applicant listing.

Prefix is set in main.py as /jobs.
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.dependencies import require_recruiter
from app.core.security import get_current_user
from app.models.job import JobCreateRequest, JobResponse, JobUpdateRequest
from app.services.supabase import supabase_admin

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _count_applicants(job_id: str) -> int:
    """Return the number of applications with eligibility_status = 'passed'."""
    resp = (
        supabase_admin.table("applications")
        .select("id", count="exact")
        .eq("job_id", job_id)
        .eq("eligibility_status", "passed")
        .execute()
    )
    return resp.count or 0


def _enrich(job: dict) -> dict:
    """Flatten job_eligibility nested list and attach applicant_count."""
    # Supabase returns the FK relation as a list; flatten it
    eligibility_rows = job.pop("job_eligibility", None) or []
    if eligibility_rows:
        job["eligibility"] = eligibility_rows[0]

    job["applicant_count"] = _count_applicants(job["id"])
    return job


def _get_owned_job(job_id: str, user: dict) -> dict:
    """Fetch a job and assert the caller owns it (HTTP 403 otherwise)."""
    resp = (
        supabase_admin.table("jobs")
        .select("*")
        .eq("id", job_id)
        .single()
        .execute()
    )
    job = resp.data
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if job["recruiter_id"] != user["sub"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this job",
        )
    return job


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

@router.get("", response_model=list)
async def list_jobs(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Public endpoint – list active jobs with optional full-text search and pagination.
    """
    query = (
        supabase_admin.table("jobs")
        .select("*, job_eligibility(*)")
        .eq("is_active", True)
    )

    if search:
        query = query.ilike("title", f"%{search}%")

    start = (page - 1) * limit
    end = start + limit - 1
    resp = query.range(start, end).execute()

    jobs = resp.data or []
    return [_enrich(j) for j in jobs]


# ---------------------------------------------------------------------------
# POST /
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_job(
    body: JobCreateRequest,
    current_user: dict = Depends(require_recruiter),
):
    """
    Recruiter-only – create a job posting and its eligibility constraints.
    """
    # 1. Insert into public.jobs
    job_row = {
        "title": body.title,
        "description": body.description,
        "requirements": body.requirements,          # Supabase accepts dicts as JSONB
        "esco_occupation_code": body.esco_occupation_code,
        "max_applicants": body.max_applicants,
        "deadline": body.deadline.isoformat() if body.deadline else None,
        "is_active": True,
        "recruiter_id": current_user["sub"],
    }

    job_resp = supabase_admin.table("jobs").insert(job_row).execute()
    if not job_resp.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create job",
        )

    created_job = job_resp.data[0]
    job_id = created_job["id"]

    # 2. Insert into public.job_eligibility
    eligibility = body.eligibility
    elig_row = {
        "job_id": job_id,
        "gender_allowed": eligibility.gender_allowed,
        "branches_allowed": eligibility.branches_allowed,
        "min_cgpa": eligibility.min_cgpa,
        "graduation_years": eligibility.graduation_years,
    }
    elig_resp = supabase_admin.table("job_eligibility").insert(elig_row).execute()
    if elig_resp.data:
        created_job["job_eligibility"] = elig_resp.data

    return _enrich(created_job)


# ---------------------------------------------------------------------------
# GET /{job_id}
# ---------------------------------------------------------------------------

@router.get("/{job_id}")
async def get_job(job_id: str):
    """
    Public endpoint – retrieve a single job by ID.
    """
    resp = (
        supabase_admin.table("jobs")
        .select("*, job_eligibility(*)")
        .eq("id", job_id)
        .single()
        .execute()
    )

    job = resp.data
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return _enrich(job)


# ---------------------------------------------------------------------------
# PUT /{job_id}
# ---------------------------------------------------------------------------

@router.put("/{job_id}")
async def update_job(
    job_id: str,
    body: JobUpdateRequest,
    current_user: dict = Depends(require_recruiter),
):
    """
    Recruiter-only – update fields of an owned job.
    """
    _get_owned_job(job_id, current_user)   # ownership check

    # Build patch dict with only provided fields
    update_dict: dict = {}
    if body.title is not None:
        update_dict["title"] = body.title
    if body.description is not None:
        update_dict["description"] = body.description
    if body.requirements is not None:
        update_dict["requirements"] = body.requirements
    if body.esco_occupation_code is not None:
        update_dict["esco_occupation_code"] = body.esco_occupation_code
    if body.max_applicants is not None:
        update_dict["max_applicants"] = body.max_applicants
    if body.deadline is not None:
        update_dict["deadline"] = body.deadline.isoformat()
    if body.is_active is not None:
        update_dict["is_active"] = body.is_active

    if update_dict:
        supabase_admin.table("jobs").update(update_dict).eq("id", job_id).execute()

    # Update eligibility if provided
    if body.eligibility is not None:
        elig = body.eligibility
        elig_dict: dict = {}
        if elig.gender_allowed is not None:
            elig_dict["gender_allowed"] = elig.gender_allowed
        if elig.branches_allowed is not None:
            elig_dict["branches_allowed"] = elig.branches_allowed
        if elig.min_cgpa is not None:
            elig_dict["min_cgpa"] = elig.min_cgpa
        if elig.graduation_years is not None:
            elig_dict["graduation_years"] = elig.graduation_years
        if elig_dict:
            supabase_admin.table("job_eligibility").update(elig_dict).eq("job_id", job_id).execute()

    # Return fresh data
    return await get_job(job_id)


# ---------------------------------------------------------------------------
# DELETE /{job_id}  (soft delete)
# ---------------------------------------------------------------------------

@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    current_user: dict = Depends(require_recruiter),
):
    """
    Recruiter-only – soft-delete (deactivate) an owned job.
    """
    _get_owned_job(job_id, current_user)
    supabase_admin.table("jobs").update({"is_active": False}).eq("id", job_id).execute()
    return {"message": "Job deactivated successfully"}


# ---------------------------------------------------------------------------
# GET /{job_id}/applicants
# ---------------------------------------------------------------------------

@router.get("/{job_id}/applicants")
async def list_applicants(
    job_id: str,
    status: Optional[str] = Query(None, description="pending | shortlisted | rejected"),
    current_user: dict = Depends(require_recruiter),
):
    """
    Recruiter-only – list applicants for an owned job, ordered by graph_rag_score DESC.
    """
    _get_owned_job(job_id, current_user)

    query = (
        supabase_admin.table("applications")
        .select("*")
        .eq("job_id", job_id)
    )

    if status:
        query = query.eq("shortlist_status", status)

    resp = query.order("graph_rag_score", desc=True).execute()
    return resp.data or []
