# PRD — Module 2 & 3: Job Management + Application & Eligibility
**File:** `03_PRD_JOBS_APPLICATIONS.md`  
**Branches:** `feature/jobs`, `feature/resume-upload`

---

## Module 2 — Job Management

### 2.1 Overview

Recruiters create job posts with a description, skill requirements, ESCO occupation mapping, eligibility rules, applicant limits, and a deadline. Jobs appear on the candidate-facing portal once published.

---

### 2.2 Pydantic Models — `backend/app/models/job.py`

```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class EligibilityFilter(BaseModel):
    gender_allowed: List[str] = ["male", "female", "other"]
    branches_allowed: Optional[List[str]] = None   # None = all branches allowed
    min_cgpa: Optional[float] = None
    graduation_years: Optional[List[int]] = None

class JobCreateRequest(BaseModel):
    title: str
    description: str
    requirements: dict           # free-form: { "skills": [...], "experience": "...", ... }
    esco_occupation_code: Optional[str] = None   # e.g. "2511.1" from ESCO
    max_applicants: int = 100
    deadline: Optional[datetime] = None
    eligibility: EligibilityFilter

class JobResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    requirements: dict
    esco_occupation_code: Optional[str]
    max_applicants: int
    deadline: Optional[datetime]
    is_active: bool
    applicant_count: int
    created_at: datetime
```

---

### 2.3 API Routes — `backend/app/api/routes/jobs.py`

#### GET `/jobs`
**Auth:** Public  
**Query params:** `?search=python&active=true&page=1&limit=20`  
**Logic:** Query `public.jobs` where `is_active=true`, join applicant count from `public.applications`. Return paginated list.

#### POST `/jobs`
**Auth:** Recruiter only  
**Logic:**
1. Validate request body (JobCreateRequest)
2. Insert into `public.jobs` with `recruiter_id = current_user.id`
3. Insert into `public.job_eligibility`
4. If `esco_occupation_code` provided, verify it exists in Neo4j: `MATCH (o:Occupation {escoCode: $code}) RETURN o`
5. Return created job

#### GET `/jobs/{job_id}`
**Auth:** Public  
**Logic:** Fetch job + eligibility filters. If requester is the job's recruiter, also return applicant stats.

#### PUT `/jobs/{job_id}`
**Auth:** Recruiter (must own the job)  
**Logic:** Update `public.jobs` and `public.job_eligibility`. Cannot update if shortlisting is in progress.

#### DELETE `/jobs/{job_id}` (soft delete)
**Auth:** Recruiter (must own the job)  
**Logic:** Set `is_active = false`. Don't delete applications data.

#### GET `/jobs/{job_id}/applicants`
**Auth:** Recruiter (must own the job)  
**Logic:** Return all applications for the job with status, score, name. Supports filter by `?status=shortlisted|rejected|pending`.

---

## Module 3 — Application & Eligibility

### 3.1 Overview

Candidates apply to a job by submitting basic details and a resume PDF. The system immediately runs an eligibility check against the job's filters. If the candidate fails, they are informed immediately and the resume is NOT stored or analyzed. If they pass, their data and resume are saved for Graph RAG shortlisting.

---

### 3.2 Pydantic Models — `backend/app/models/application.py`

```python
from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid

class ApplicationCreateRequest(BaseModel):
    job_id: uuid.UUID
    full_name: str
    email: EmailStr
    phone: str
    branch: str               # e.g. "Computer Science", "Mechanical Engineering"
    graduation_year: int      # e.g. 2025
    cgpa: float               # e.g. 8.4
    gender: str               # "male" | "female" | "other"
    # Resume file comes as multipart form upload, not in this model

class ApplicationResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    full_name: str
    email: str
    eligibility_status: str
    shortlist_status: str
    graph_rag_score: Optional[float]
    applied_at: str
```

---

### 3.3 Eligibility Check Logic — `backend/app/services/eligibility.py`

```python
def check_eligibility(application: dict, filters: dict) -> tuple[bool, str]:
    """
    Returns (passed: bool, reason: str)
    reason is empty string if passed, human-readable if failed.
    """
    # Check gender
    if filters["gender_allowed"] and application["gender"] not in filters["gender_allowed"]:
        return False, f"This role is open to: {', '.join(filters['gender_allowed'])}"

    # Check branch
    if filters["branches_allowed"] and application["branch"] not in filters["branches_allowed"]:
        return False, f"Required branches: {', '.join(filters['branches_allowed'])}"

    # Check CGPA
    if filters["min_cgpa"] and application["cgpa"] < filters["min_cgpa"]:
        return False, f"Minimum CGPA required: {filters['min_cgpa']}"

    # Check graduation year
    if filters["graduation_years"] and application["graduation_year"] not in filters["graduation_years"]:
        return False, f"Open to graduation years: {', '.join(map(str, filters['graduation_years']))}"

    return True, ""
```

---

### 3.4 API Routes — `backend/app/api/routes/applications.py`

#### POST `/applications`
**Auth:** Candidate (or public — no auth required to apply)  
**Content-Type:** `multipart/form-data`  
**Form fields:** all ApplicationCreateRequest fields + `resume` (PDF file)

**Logic (in order):**

```
1. Parse form data + file
2. Validate file: must be PDF, size < 5MB
3. Check job is active + deadline not passed
4. Check max_applicants not reached:
   count = SELECT COUNT(*) FROM applications WHERE job_id = ? AND eligibility_status = 'passed'
   if count >= job.max_applicants → return 400 "Applications closed"
5. Check duplicate: same email + job_id → return 400 "Already applied"
6. Fetch job eligibility filters from public.job_eligibility
7. Run check_eligibility()
8. If FAILED:
   → Insert application with eligibility_status='failed' (for audit log)
   → Return 200 { "eligible": false, "reason": "..." }
   → DO NOT upload resume
9. If PASSED:
   → Upload resume to Supabase Storage: path = f"resumes/{job_id}/{application_id}.pdf"
   → Insert application with eligibility_status='passed', resume_path=path
   → Return 200 { "eligible": true, "application_id": "..." }
```

**Response (passed):**
```json
{
  "eligible": true,
  "application_id": "uuid",
  "message": "Application submitted successfully. You will be notified by email."
}
```

**Response (failed):**
```json
{
  "eligible": false,
  "reason": "Minimum CGPA required: 7.0",
  "message": "Unfortunately you do not meet the eligibility criteria for this role."
}
```

---

### 3.5 Resume Upload — `backend/app/services/resume_upload.py`

```python
async def upload_resume(file_bytes: bytes, job_id: str, application_id: str) -> str:
    """
    Uploads resume to Supabase Storage.
    Returns the storage path string.
    """
    path = f"resumes/{job_id}/{application_id}.pdf"
    supabase_admin.storage.from_("resumes").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": "application/pdf"}
    )
    return path

async def get_resume_bytes(path: str) -> bytes:
    """
    Downloads resume bytes for Graph RAG processing.
    Called by the Celery shortlisting task.
    """
    response = supabase_admin.storage.from_("resumes").download(path)
    return response
```

---

### 3.6 Tests to Write

**Jobs:**
- Recruiter creates job → 200, job stored
- Non-recruiter creates job → 403
- GET /jobs returns only active jobs
- GET /jobs/{id}/applicants returns correct applications

**Applications:**
- Valid application with passing eligibility → 200, resume uploaded
- Valid application with failing CGPA → 200 but eligible=false, resume NOT uploaded
- Apply to same job twice same email → 400
- Apply after deadline → 400
- Apply when max applicants reached → 400
- Non-PDF file upload → 422

---

### 3.7 Antigravity Prompts

**Prompt — Job routes:**
```
Create backend/app/api/routes/jobs.py with FastAPI APIRouter.

GET /jobs: query Supabase public.jobs table where is_active=true. Accept query params
search (filter by title ilike), page and limit for pagination.
Return list with applicant_count (count of applications with eligibility_status='passed').

POST /jobs: require recruiter role (use require_recruiter dependency).
Accept JobCreateRequest body. Insert into public.jobs and public.job_eligibility.
Return created job.

GET /jobs/{job_id}: return job details. If current user is the recruiter, include applicant stats.

GET /jobs/{job_id}/applicants: recruiter only. Return all applications for job.
Support ?status= filter for shortlisted|rejected|pending.

Import from app.services.supabase, app.core.dependencies, app.models.job.
```

**Prompt — Application routes:**
```
Create backend/app/api/routes/applications.py.

POST /applications: accept multipart/form-data with fields:
job_id, full_name, email, phone, branch, graduation_year, cgpa, gender, and file upload "resume".

Steps:
1. Validate file is PDF under 5MB
2. Check job is active and deadline not passed using supabase_admin
3. Check applicant count < job.max_applicants
4. Check no duplicate application (same email + job_id)
5. Fetch job_eligibility row and run check_eligibility() from app.services.eligibility
6. If failed: insert application with eligibility_status='failed', return eligible:false with reason
7. If passed: upload file to Supabase Storage via upload_resume(), insert application
   with eligibility_status='passed' and resume_path, return eligible:true with application_id

All Supabase calls use supabase_admin client.
```
