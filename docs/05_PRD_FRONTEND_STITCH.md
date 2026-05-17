# PRD — Modules 8 & 9: Frontend (Google Stitch)
**File:** `05_PRD_FRONTEND_STITCH.md`  
**Branches:** `feature/frontend-candidate`, `feature/frontend-recruiter`

---

## Overview

Two distinct UI surfaces built in Google Stitch, connected to the FastAPI backend via REST API and WebSocket. Stitch is connected to Antigravity via MCP for AI-assisted development.

**Backend base URL:** `https://your-railway-app.railway.app` (or `http://localhost:8000` for local dev)

All API calls include header: `Authorization: Bearer {token}` when user is logged in.

---

## Module 8 — Candidate Portal

### Pages

#### 1. Landing / Login Page (`/`)
- App name + tagline: "Find your next role. Apply intelligently."
- Two buttons: **Login** | **Register**
- Clean centered card layout

#### 2. Register Page (`/register`)
- Fields: Full Name, Email, Password, Role (toggle: Candidate / Recruiter)
- On submit: `POST /auth/register`
- On success: redirect to `/jobs` (candidate) or `/recruiter/dashboard` (recruiter)

#### 3. Login Page (`/login`)
- Fields: Email, Password
- On submit: `POST /auth/login`
- Store token in Stitch state/localStorage
- Redirect based on role

#### 4. Job Listings Page (`/jobs`)
- `GET /jobs` on load
- Search bar (calls `GET /jobs?search=term`)
- Job cards showing: Title, Company, Deadline, Branch requirements
- Each card has **Apply Now** button
- If deadline passed or max applicants reached: show "Closed" badge

#### 5. Job Detail Page (`/jobs/{id}`)
- Full job description
- Requirements section
- Eligibility criteria (clearly shown: branches, CGPA, year, gender)
- **Apply Now** button → opens application modal

#### 6. Application Modal (appears on Apply click)
- Fields:
  - Full Name (pre-fill if logged in)
  - Email (pre-fill if logged in)
  - Phone
  - Branch (dropdown: CS, IT, ECE, Mechanical, Civil, etc.)
  - Graduation Year (dropdown: 2023–2027)
  - CGPA (number input, 0–10)
  - Gender (dropdown)
  - Resume Upload (PDF only, drag-and-drop or click)
- Submit → `POST /applications` as multipart/form-data
- Show spinner during upload
- **On success (eligible=true):** Green toast "Application submitted! You'll hear from us soon."
- **On success (eligible=false):** Orange banner showing the specific eligibility failure reason
- **On error:** Red toast with error message

#### 7. My Applications Page (`/my-applications`) — requires login
- List of candidate's applications
- Columns: Job Title, Applied Date, Eligibility Status, Shortlist Status
- Status badges: Pending (gray), Shortlisted (green), Rejected (red)

---

## Module 9 — Recruiter Portal

### Pages

#### 1. Recruiter Dashboard (`/recruiter/dashboard`)
- Summary cards: Total Jobs Posted, Total Applications Received, Pending Shortlists
- List of recruiter's jobs with quick stats
- **+ Post New Job** button

#### 2. Post Job Page (`/recruiter/jobs/new`)
Fields:
- Job Title (text)
- Description (rich text or large textarea)
- Requirements (key-value pairs: add skill tags)
- ESCO Occupation Code (text field with helper note: "Find code at esco.ec.europa.eu")
- Max Applicants (number, default 100)
- Application Deadline (date-time picker)

**Eligibility Filters section:**
- Gender Allowed (multi-select: Male, Female, Other, Any)
- Branches Allowed (multi-select of engineering branches, or leave empty for all)
- Minimum CGPA (number input, optional)
- Graduation Years (multi-select, optional)

On submit: `POST /jobs`  
On success: redirect to `/recruiter/jobs/{id}`

#### 3. Job Detail + Applicants Page (`/recruiter/jobs/{id}`)

**Header section:**
- Job title, status badge (Active/Closed), deadline, applicant count vs max
- Edit Job button → opens edit form
- Toggle Active/Inactive button

**Applicants section:**
- Tab bar: All | Eligible | Shortlisted | Rejected
- Table columns: Name, Email, Branch, CGPA, Grad Year, Score, Status, Applied Date
- Score column only visible for shortlisted/rejected (shows Graph RAG score as progress bar)
- Click row → expand to see Gemini explanation paragraph

**Shortlisting Panel (bottom or sidebar):**
- Number input: "Shortlist top __ candidates"
- **Run Shortlisting** button
- On click: `POST /shortlist` → opens progress modal

#### 4. Shortlisting Progress Modal
- Shows while shortlisting runs
- WebSocket connection to `ws://backend/ws/shortlist/{task_id}`
- Progress bar: "Analyzing resume 34 of 120..."
- Candidate names scroll as they are processed
- On completion: "Shortlisting complete! 20 candidates selected." → close button
- Automatically refreshes applicants table on close

#### 5. Shortlisted Candidates View (`/recruiter/jobs/{id}?tab=shortlisted`)
- Ranked table of shortlisted candidates (highest score first)
- Columns: Rank, Name, Email, Score (0-100), Matched Skills, Actions
- Expand row to see: full Gemini explanation paragraph, matched skills list, skill gaps
- Actions: Download Resume (signed URL from Supabase), Send custom email (future scope)

---

## Stitch Configuration Notes

### API Connection Setup in Stitch
1. In Stitch, create a new **REST API data source**
2. Base URL: `https://your-backend.railway.app`
3. Authentication: Bearer token (store in Stitch's user session state)
4. Create one data source action per endpoint

### WebSocket in Stitch
Stitch may not natively support WebSocket. Options:
1. Use polling: `GET /shortlist/status/{task_id}` every 2 seconds while status is 'running'
2. If Stitch supports custom JS: use native `WebSocket` API in a custom component

### File Upload in Stitch
- Use Stitch's file upload component for the resume field
- Set accept type to `application/pdf`
- Connect to `POST /applications` multipart action

---

## Stitch Prompts (for Antigravity MCP connection)

**Prompt 1 — Job Listings Page:**
```
Create a page in Google Stitch that shows a list of active job postings.
On page load, call GET /jobs from the backend API.
Display each job as a card with: title, description preview (first 150 chars),
deadline, and an Apply Now button.
Add a search input at the top that calls GET /jobs?search={term} on input change (debounce 500ms).
Show a "Closed" badge if the job has reached max_applicants.
```

**Prompt 2 — Application Modal:**
```
Create a modal dialog in Stitch that appears when Apply Now is clicked on a job card.
Form fields: Full Name (text), Email (email), Phone (text), Branch (select with options:
Computer Science, Information Technology, Electronics, Mechanical, Civil, Chemical, Other),
Graduation Year (select: 2023,2024,2025,2026,2027), CGPA (number 0-10), Gender (select: Male, Female, Other),
Resume (file upload, accept PDF only).

On submit, POST to /applications as multipart/form-data.
If response.eligible is true: show green success message and close modal.
If response.eligible is false: show orange banner inside modal with response.reason text.
Show loading spinner on the submit button while request is pending.
```

**Prompt 3 — Recruiter Dashboard:**
```
Create a recruiter dashboard page in Stitch.
Show three summary stat cards: "Jobs Posted", "Total Applications", "Pending Shortlists".
Below, show a table of the recruiter's jobs from GET /jobs (filtered to their own).
Table columns: Title, Status (Active/Closed), Applicants, Deadline, Actions.
Actions column has: View Applicants button, Edit button.
Add a "+ Post New Job" button in the top right that navigates to the new job form page.
```

**Prompt 4 — Shortlisting Panel:**
```
On the recruiter job detail page, add a "Run Shortlisting" panel at the bottom.
It has a number input labeled "Shortlist top N candidates" defaulting to 10.
A "Run Shortlisting" button that calls POST /shortlist with { job_id, shortlist_count }.

After clicking, open a modal that shows shortlisting progress.
Poll GET /shortlist/status/{task_id} every 3 seconds.
Show progress as "Analyzing {current} of {total} resumes...".
When status becomes 'done', show "Shortlisting complete! Refresh to see results." and a Close button.
On close, reload the applicants table by calling GET /applications/job/{job_id}.
```

**Prompt 5 — Shortlisted Candidates Table:**
```
On the recruiter job detail page, add a tabs component with: All, Eligible, Shortlisted, Rejected.
Each tab fetches GET /applications/job/{job_id}?status={tab} from the backend.

For the Shortlisted tab, show columns: Rank (row number), Name, Email, Score (show as progress bar 0-100),
Applied Date, Expand button.

When Expand is clicked on a row, show below it:
- "Gemini Analysis:" followed by graph_rag_explanation text
- "Skills Matched:" followed by a list of matched_skills
- "Skill Gaps:" followed by a list of gap_skills in red
- "Download Resume" button (link to Supabase signed URL)
```

---

## Deployment Checklist

### Railway (Backend)
1. railway.app → New project → Deploy from GitHub repo
2. Root directory: `backend`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add all env vars in Railway dashboard
5. Add a second Railway service for Celery worker:
   - Start command: `celery -A app.tasks.celery_app worker --loglevel=info`
   - Same env vars

### Post-deployment
1. Test `https://your-app.railway.app/health` → `{"status":"ok"}`
2. Test `/docs` for Swagger UI
3. Update Stitch API base URL to Railway URL
4. Run ESCO import pointing to production Neo4j
