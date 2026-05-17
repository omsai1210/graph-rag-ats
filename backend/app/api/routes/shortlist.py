from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.core.dependencies import require_recruiter
from app.core.security import get_current_user
from app.services.supabase import supabase_admin
from app.tasks.shortlist_task import run_shortlisting

router = APIRouter()

class ShortlistRequest(BaseModel):
    job_id: str
    shortlist_count: int

@router.post("/")
async def start_shortlisting(request: ShortlistRequest, current_user: dict = Depends(require_recruiter)):
    # 1. Verify recruiter owns the job
    job = supabase_admin.table("jobs").select("*").eq("id", request.job_id).single().execute().data
    if not job: 
        raise HTTPException(status_code=404, detail="Job not found")
    if job["recruiter_id"] != current_user["sub"]: 
        raise HTTPException(status_code=403, detail="Not your job")

    # 2. Check no active task already running
    active = supabase_admin.table("shortlist_tasks").select("*").eq(
        "job_id", request.job_id).eq("status", "running").execute()
    if active.data: 
        raise HTTPException(status_code=400, detail="Shortlisting already in progress for this job")

    # 3. Insert shortlist_tasks row
    task_id = str(uuid.uuid4())
    supabase_admin.table("shortlist_tasks").insert({
        "id": task_id,
        "job_id": request.job_id,
        "requested_by": current_user["sub"],
        "shortlist_count": request.shortlist_count,
        "status": "queued",
        "created_at": datetime.utcnow().isoformat()
    }).execute()

    # 4. Fire Celery task
    run_shortlisting.delay(
        request.job_id,
        request.shortlist_count,
        task_id,
        current_user["sub"]
    )

    # 5. Return
    return { "task_id": task_id, "message": f"Shortlisting started. Check status at /shortlist/status/{task_id}" }

@router.get("/status/{task_id}")
async def get_shortlist_status(task_id: str, current_user: dict = Depends(require_recruiter)):
    resp = supabase_admin.table("shortlist_tasks").select("*").eq("id", task_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Task not found")
    return resp.data
