"""
Applications routes.

POST /applications  – public, multipart/form-data
Handles validation, eligibility check, resume upload and DB insertion in one shot.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.models.application import EligibilityCheckResult
from app.services.eligibility import check_eligibility
from app.services.resume_upload import upload_resume
from app.services.supabase import supabase_admin

router = APIRouter()

_MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB


# ---------------------------------------------------------------------------
# POST /
# ---------------------------------------------------------------------------

@router.post("/", response_model=EligibilityCheckResult, status_code=status.HTTP_201_CREATED)
async def submit_application(
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    branch: str = Form(...),
    graduation_year: int = Form(...),
    cgpa: float = Form(...),
    gender: str = Form(...),
    job_id: str = Form(...),
    resume: UploadFile = File(...),
):
    """
    Public endpoint – submit a job application with resume PDF.

    Steps:
    1. Validate file type and size
    2. Verify the job exists and is active
    3. Check deadline
    4. Check max-applicant cap
    5. Check for duplicate applications
    6. Fetch eligibility filters
    7. Run eligibility check
    8a. Ineligible  → insert record with eligibility_status=failed, return 201 with eligible=False
    8b. Eligible    → insert record, upload resume, update resume_path, return 201 with eligible=True
    """
    try:
        # ------------------------------------------------------------------
        # Step 1 — Validate file
        # ------------------------------------------------------------------
        if resume.content_type != "application/pdf":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only PDF files are accepted",
            )

        file_bytes = await resume.read()

        if len(file_bytes) > _MAX_RESUME_BYTES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Resume must be under 5MB",
            )

        # ------------------------------------------------------------------
        # Step 2 — Job exists and is active
        # ------------------------------------------------------------------
        job_resp = (
            supabase_admin.table("jobs")
            .select("*")
            .eq("id", job_id)
            .eq("is_active", True)
            .single()
            .execute()
        )
        if not job_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found or no longer active",
            )
        job = job_resp.data

        # ------------------------------------------------------------------
        # Step 3 — Deadline check
        # ------------------------------------------------------------------
        if job.get("deadline") is not None:
            deadline_dt = datetime.fromisoformat(job["deadline"])
            # Make both timezone-naive for comparison
            if deadline_dt.tzinfo is not None:
                deadline_dt = deadline_dt.replace(tzinfo=None)
            if datetime.utcnow() > deadline_dt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Application deadline has passed",
                )

        # ------------------------------------------------------------------
        # Step 4 — Max applicants cap
        # ------------------------------------------------------------------
        count_resp = (
            supabase_admin.table("applications")
            .select("id", count="exact")
            .eq("job_id", job_id)
            .eq("eligibility_status", "passed")
            .execute()
        )
        if (count_resp.count or 0) >= job["max_applicants"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum number of applicants reached for this job",
            )

        # ------------------------------------------------------------------
        # Step 5 — Duplicate application check
        # ------------------------------------------------------------------
        dup_resp = (
            supabase_admin.table("applications")
            .select("id")
            .eq("job_id", job_id)
            .eq("email", email)
            .execute()
        )
        if dup_resp.data and len(dup_resp.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already applied for this job",
            )

        # ------------------------------------------------------------------
        # Step 6 — Fetch eligibility filters
        # ------------------------------------------------------------------
        elig_resp = (
            supabase_admin.table("job_eligibility")
            .select("*")
            .eq("job_id", job_id)
            .single()
            .execute()
        )
        filters = elig_resp.data if elig_resp.data else {}

        # ------------------------------------------------------------------
        # Step 7 — Run eligibility check
        # ------------------------------------------------------------------
        application_dict = {
            "gender": gender,
            "branch": branch,
            "cgpa": cgpa,
            "graduation_year": graduation_year,
        }
        passed, reason = check_eligibility(application_dict, filters)

        # ------------------------------------------------------------------
        # Step 8a — Ineligible: insert record, return immediately
        # ------------------------------------------------------------------
        if not passed:
            supabase_admin.table("applications").insert(
                {
                    "job_id": job_id,
                    "full_name": full_name,
                    "email": email,
                    "phone": phone,
                    "branch": branch,
                    "graduation_year": graduation_year,
                    "cgpa": cgpa,
                    "gender": gender,
                    "eligibility_status": "failed",
                    "shortlist_status": "pending",
                    "resume_path": None,
                }
            ).execute()

            return EligibilityCheckResult(
                eligible=False,
                reason=reason,
                application_id=None,
                message="Unfortunately you do not meet the eligibility criteria for this role.",
            )

        # ------------------------------------------------------------------
        # Step 8b — Eligible: insert, upload resume, update path
        # ------------------------------------------------------------------
        insert_resp = (
            supabase_admin.table("applications")
            .insert(
                {
                    "job_id": job_id,
                    "full_name": full_name,
                    "email": email,
                    "phone": phone,
                    "branch": branch,
                    "graduation_year": graduation_year,
                    "cgpa": cgpa,
                    "gender": gender,
                    "eligibility_status": "passed",
                    "shortlist_status": "pending",
                    "resume_path": None,
                }
            )
            .execute()
        )
        application_id = insert_resp.data[0]["id"]

        # Upload resume to Supabase Storage
        resume_path = await upload_resume(file_bytes, job_id, application_id)

        # Patch the record with the storage path
        supabase_admin.table("applications").update(
            {"resume_path": resume_path}
        ).eq("id", application_id).execute()

        return EligibilityCheckResult(
            eligible=True,
            application_id=application_id,
            message="Application submitted successfully. You will be notified by email of the outcome.",
        )

    except HTTPException:
        # Re-raise FastAPI HTTP errors without wrapping them
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
