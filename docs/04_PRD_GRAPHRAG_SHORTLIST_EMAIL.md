# PRD — Modules 4–7: ESCO Graph + Graph RAG + Shortlisting + Email
**File:** `04_PRD_GRAPHRAG_SHORTLIST_EMAIL.md`  
**Branches:** `feature/esco-import`, `feature/graph-rag`, `feature/shortlisting`, `feature/email`

---

## Module 4 — ESCO Graph (Neo4j)

### 4.1 Neo4j Schema

```cypher
// Occupation node
CREATE (o:Occupation {
  escoCode: "2511.1",
  label: "Software Developer",
  description: "...",
  iscoGroup: "2511"
})

// Skill node
CREATE (s:Skill {
  escoCode: "S5.6.0",
  label: "Python",
  skillType: "skill/competence",  // or "knowledge" or "language"
  description: "..."
})

// Occupation requires skill (essential or optional)
CREATE (o)-[:REQUIRES {importance: "essential"}]->(s)

// Skill hierarchy (broader = parent)
CREATE (child_skill)-[:BROADER]->(parent_skill)

// Related skills (cross-domain)
CREATE (s1)-[:RELATED_TO]->(s2)
```

### 4.2 ESCO Import Script — `backend/scripts/import_esco.py`

**Inputs:** CSV files in `data/esco/`  
**Runtime:** ~10-15 min on AuraDB Free  
**Run once:** `python backend/scripts/import_esco.py`

```python
"""
Steps:
1. Read occupations_en.csv → create :Occupation nodes in batches of 500
2. Read skills_en.csv → create :Skill nodes in batches of 500
3. Read skillsHierarchy_en.csv → create [:BROADER] relationships
4. Read occupationSkillRelations.csv → create [:REQUIRES] relationships
5. Create indexes for fast lookup:
   CREATE INDEX occupation_code IF NOT EXISTS FOR (o:Occupation) ON (o.escoCode)
   CREATE INDEX skill_code IF NOT EXISTS FOR (s:Skill) ON (s.escoCode)
   CREATE INDEX skill_label IF NOT EXISTS FOR (s:Skill) ON (s.label)
   CREATE FULLTEXT INDEX skill_fulltext IF NOT EXISTS FOR (s:Skill) ON EACH [s.label, s.description]
"""

import pandas as pd
from neo4j import GraphDatabase
from tqdm import tqdm
from app.core.config import settings

driver = GraphDatabase.driver(
    settings.neo4j_uri,
    auth=(settings.neo4j_username, settings.neo4j_password)
)

def import_occupations(session, df):
    query = """
    UNWIND $batch AS row
    MERGE (o:Occupation {escoCode: row.conceptUri})
    SET o.label = row.preferredLabel,
        o.description = row.description,
        o.iscoGroup = row.iscoGroup
    """
    # Batch insert in groups of 500
    ...

def import_skills(session, df):
    query = """
    UNWIND $batch AS row
    MERGE (s:Skill {escoCode: row.conceptUri})
    SET s.label = row.preferredLabel,
        s.description = row.description,
        s.skillType = row.skillType
    """
    ...

# Run all imports with progress bars using tqdm
```

### 4.3 ESCO Mapper — `backend/app/graph/esco_mapper.py`

Maps free-text skill strings extracted from a resume to actual ESCO skill nodes.

**Function: `map_text_to_esco_skills(text: str) -> list[dict]`**

```
Algorithm:
1. Extract candidate skill tokens from resume text using simple NLP
   (split on commas/newlines in skills section, or use spaCy noun chunks)
2. For each token, run Neo4j fulltext search:
   CALL db.index.fulltext.queryNodes('skill_fulltext', $query)
   YIELD node, score WHERE score > 1.5
   RETURN node.escoCode, node.label, score LIMIT 3
3. Take best match per token (highest score)
4. Return list of { escoCode, label, confidence }
```

---

## Module 5 — Graph RAG Scoring Chain

### 5.1 Architecture

```
resume PDF
    ↓ PyMuPDF extract text
    ↓ esco_mapper.map_text_to_esco_skills()
    ↓ [list of matched ESCO skill nodes]
    ↓ Neo4j graph traversal (Cypher scoring query)
    ↓ numeric score 0–100
    ↓ Gemini explanation generation
    ↓ { score, explanation, matched_skills, gap_skills }
```

### 5.2 Resume Text Extraction — `backend/app/graph/rag_chain.py`

```python
import fitz  # PyMuPDF

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    return text
```

### 5.3 Core Scoring Cypher Query

```cypher
// Given a list of candidate skill codes and the job's occupation code,
// score the candidate using graph traversal

WITH $candidate_skill_codes AS candidate_skills,
     $occupation_code AS job_occ

// Get all skills required by the job's occupation
MATCH (job_occ_node:Occupation {escoCode: job_occ})-[r:REQUIRES]->(required_skill:Skill)
WITH collect({skill: required_skill, importance: r.importance}) AS required,
     candidate_skills

// Score each required skill
UNWIND required AS req
WITH req.skill AS rs, req.importance AS imp, candidate_skills

// Direct match (candidate has this exact skill)
OPTIONAL MATCH (cs:Skill)
WHERE cs.escoCode IN candidate_skills AND cs.escoCode = rs.escoCode
WITH rs, imp, cs, candidate_skills

// 1-hop match (candidate has a skill broader than or related to required)
OPTIONAL MATCH (cs1:Skill)-[:BROADER|RELATED_TO]->(rs)
WHERE cs1.escoCode IN candidate_skills
WITH rs, imp, cs, cs1, candidate_skills

// 2-hop match
OPTIONAL MATCH (cs2:Skill)-[:BROADER|RELATED_TO*2]->(rs)
WHERE cs2.escoCode IN candidate_skills

RETURN
  rs.label AS required_skill,
  imp AS importance,
  CASE WHEN cs IS NOT NULL THEN 3
       WHEN cs1 IS NOT NULL THEN 1.5
       WHEN cs2 IS NOT NULL THEN 0.75
       ELSE 0 END AS score,
  CASE WHEN cs IS NOT NULL THEN cs.label
       WHEN cs1 IS NOT NULL THEN cs1.label
       WHEN cs2 IS NOT NULL THEN cs2.label
       ELSE null END AS matched_via
```

### 5.4 Score Normalization

```python
def normalize_score(raw_scores: list[dict], required_count: int) -> float:
    """
    Maximum possible: all essential skills direct match = 3 × count
    Normalize to 0–100
    """
    total = sum(row["score"] for row in raw_scores)
    max_possible = required_count * 3
    if max_possible == 0:
        return 0.0
    return round((total / max_possible) * 100, 2)
```

### 5.5 Full Scoring Function

```python
async def score_candidate(
    resume_bytes: bytes,
    occupation_code: str,
    neo4j_session
) -> dict:
    # 1. Extract text
    text = extract_text_from_pdf(resume_bytes)

    # 2. Map to ESCO skills
    candidate_skills = map_text_to_esco_skills(text)
    candidate_codes = [s["escoCode"] for s in candidate_skills]

    # 3. Run Cypher scoring
    results = neo4j_session.run(SCORING_CYPHER, {
        "candidate_skill_codes": candidate_codes,
        "occupation_code": occupation_code
    }).data()

    # 4. Normalize
    score = normalize_score(results, len(results))

    # 5. Find gaps (required skills with score=0)
    gaps = [r["required_skill"] for r in results if r["score"] == 0 and r["importance"] == "essential"]
    matched = [r for r in results if r["score"] > 0]

    return {
        "score": score,
        "matched_skills": matched,
        "gap_skills": gaps,
        "candidate_skills_found": candidate_skills
    }
```

---

## Module 6 — Async Shortlisting with Celery

### 6.1 Celery App — `backend/app/tasks/celery_app.py`

```python
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "ats_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.shortlist_task"]
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_prefetch_multiplier=1,   # process one job at a time per worker
)
```

### 6.2 Shortlisting Task — `backend/app/tasks/shortlist_task.py`

```python
@celery_app.task(bind=True)
def run_shortlisting(self, job_id: str, shortlist_count: int, task_db_id: str, recruiter_id: str):
    """
    Main shortlisting task. Runs in background worker.
    Updates task status in DB as it progresses.
    Sends WebSocket progress updates via Redis pub/sub.
    """
    # 1. Update task status to 'running'
    supabase_admin.table("shortlist_tasks").update(
        {"status": "running", "started_at": datetime.utcnow().isoformat()}
    ).eq("id", task_db_id).execute()

    # 2. Fetch all eligible (passed) applications for this job
    apps = supabase_admin.table("applications").select("*").eq(
        "job_id", job_id
    ).eq("eligibility_status", "passed").execute().data

    total = len(apps)
    scores = []

    # 3. Score each candidate
    with GraphDatabase.driver(...) as driver:
        with driver.session() as neo4j_session:
            for i, app in enumerate(apps):
                try:
                    # Publish progress to Redis for WebSocket
                    redis_client.publish(
                        f"shortlist:{task_db_id}",
                        json.dumps({"current": i+1, "total": total, "name": app["full_name"]})
                    )

                    # Download resume
                    resume_bytes = get_resume_bytes(app["resume_path"])

                    # Score
                    result = score_candidate(resume_bytes, job["esco_occupation_code"], neo4j_session)
                    result["application_id"] = app["id"]
                    result["email"] = app["email"]
                    result["full_name"] = app["full_name"]
                    scores.append(result)

                except Exception as e:
                    # Skip failed resume, log error, continue
                    continue

    # 4. Sort by score descending
    scores.sort(key=lambda x: x["score"], reverse=True)

    # 5. Mark top N as shortlisted, rest as rejected
    shortlisted = scores[:shortlist_count]
    rejected = scores[shortlist_count:]

    for s in shortlisted:
        supabase_admin.table("applications").update({
            "shortlist_status": "shortlisted",
            "graph_rag_score": s["score"],
            "graph_rag_explanation": generate_selection_explanation(s)  # Gemini call
        }).eq("id", s["application_id"]).execute()

    for r in rejected:
        supabase_admin.table("applications").update({
            "shortlist_status": "rejected",
            "graph_rag_score": r["score"],
            "graph_rag_explanation": generate_rejection_explanation(r)  # Gemini call
        }).eq("id", r["application_id"]).execute()

    # 6. Send emails (see Module 7)
    send_emails_batch(shortlisted, rejected, job)

    # 7. Mark task done
    supabase_admin.table("shortlist_tasks").update({
        "status": "done",
        "completed_at": datetime.utcnow().isoformat()
    }).eq("id", task_db_id).execute()
```

### 6.3 Shortlist API Routes — `backend/app/api/routes/shortlist.py`

#### POST `/shortlist`
**Auth:** Recruiter  
**Body:** `{ "job_id": "uuid", "shortlist_count": 20 }`

**Logic:**
1. Verify recruiter owns the job
2. Check no active shortlisting task already running for this job
3. Insert row into `public.shortlist_tasks` with status='queued'
4. Call `run_shortlisting.delay(job_id, shortlist_count, task_id, recruiter_id)`
5. Return `{ "task_id": "uuid", "message": "Shortlisting started" }`

#### GET `/shortlist/status/{task_id}`
**Auth:** Recruiter  
**Returns:** `{ "status": "running|done|failed", "progress": { "current": 45, "total": 120 } }`

### 6.4 WebSocket — `backend/app/api/routes/websocket.py`

```python
@router.websocket("/shortlist/{task_id}")
async def shortlist_progress(websocket: WebSocket, task_id: str):
    await websocket.accept()
    pubsub = redis_client.pubsub()
    pubsub.subscribe(f"shortlist:{task_id}")
    try:
        for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pubsub.unsubscribe()
```

### 6.5 Start Celery Worker

```bash
# In a separate terminal
cd backend
source .venv/bin/activate
celery -A app.tasks.celery_app worker --loglevel=info
```

---

## Module 7 — Gemini Explanation + Resend Email

### 7.1 Gemini Service — `backend/app/services/gemini.py`

```python
import google.generativeai as genai
from app.core.config import settings

genai.configure(api_key=settings.gemini_api_key)
model = genai.GenerativeModel("gemini-1.5-pro")

def generate_selection_explanation(score_result: dict) -> str:
    """
    Generates a paragraph explaining why this candidate was shortlisted.
    Used in DB storage and email body.
    """
    matched = [s["required_skill"] for s in score_result["matched_skills"]]
    prompt = f"""
You are an HR assistant writing a professional explanation of why a candidate was shortlisted.

Candidate: {score_result['full_name']}
Match score: {score_result['score']}/100
Skills matched: {', '.join(matched)}

Write 2-3 sentences explaining their selection. Be specific about the skills matched.
Be warm and professional. Do not use bullet points.
"""
    response = model.generate_content(prompt)
    return response.text

def generate_rejection_explanation(score_result: dict) -> str:
    """
    Generates an empathetic rejection with specific skill gap advice.
    """
    gaps = score_result["gap_skills"]
    prompt = f"""
You are an HR assistant writing a constructive rejection email body paragraph.

Candidate: {score_result['full_name']}
Match score: {score_result['score']}/100
Skill gaps identified: {', '.join(gaps) if gaps else 'general experience level'}

Write 2-3 sentences. Acknowledge their application warmly, mention the specific skills
they could develop (reference the gaps), and encourage them to apply for future roles.
Be empathetic and constructive. Do not use bullet points.
"""
    response = model.generate_content(prompt)
    return response.text
```

### 7.2 Email Service — `backend/app/services/email.py`

```python
import resend
from app.core.config import settings

resend.api_key = settings.resend_api_key

def send_selection_email(to_email: str, candidate_name: str, job_title: str, explanation: str):
    resend.Emails.send({
        "from": settings.resend_from_email,
        "to": to_email,
        "subject": f"You've been shortlisted for {job_title}",
        "html": f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a7f4b;">Congratulations, {candidate_name}!</h2>
            <p>We are pleased to inform you that you have been shortlisted for the position of <strong>{job_title}</strong>.</p>
            <p>{explanation}</p>
            <p>Our team will be in touch shortly with next steps.</p>
            <p>Best regards,<br>The Recruitment Team</p>
        </div>
        """
    })

def send_rejection_email(to_email: str, candidate_name: str, job_title: str, explanation: str):
    resend.Emails.send({
        "from": settings.resend_from_email,
        "to": to_email,
        "subject": f"Your application for {job_title}",
        "html": f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Thank you for applying, {candidate_name}</h2>
            <p>Thank you for your interest in the <strong>{job_title}</strong> position.</p>
            <p>{explanation}</p>
            <p>We encourage you to apply for future openings that match your profile.</p>
            <p>Best regards,<br>The Recruitment Team</p>
        </div>
        """
    })

def send_emails_batch(shortlisted: list, rejected: list, job: dict):
    for s in shortlisted:
        send_selection_email(s["email"], s["full_name"], job["title"], s.get("graph_rag_explanation", ""))
    for r in rejected:
        send_rejection_email(r["email"], r["full_name"], job["title"], r.get("graph_rag_explanation", ""))
```

---

## Antigravity Prompts for These Modules

**Prompt — ESCO Import:**
```
Create backend/scripts/import_esco.py.
Read four CSV files from data/esco/:
- occupations_en.csv (columns: conceptUri, preferredLabel, description, iscoGroup)
- skills_en.csv (columns: conceptUri, preferredLabel, description, skillType)
- skillsHierarchy_en.csv (columns: conceptUri, broaderUri)
- occupationSkillRelations.csv (columns: occupationUri, relationType, skillUri, importance)

Connect to Neo4j using settings from app.core.config.
Import in batches of 500 using UNWIND.
Create indexes: occupation_code, skill_code, skill_label (unique), and FULLTEXT index on skill label+description called 'skill_fulltext'.
Show progress with tqdm. Print summary counts when done.
```

**Prompt — Graph RAG Chain:**
```
Create backend/app/graph/rag_chain.py.

Function extract_text_from_pdf(pdf_bytes: bytes) -> str:
  Use PyMuPDF (fitz) to extract all text from PDF bytes.

Function score_candidate(resume_bytes, occupation_code, neo4j_session) -> dict:
  1. Extract text from PDF
  2. Call esco_mapper.map_text_to_esco_skills(text) to get ESCO codes
  3. Run this Cypher query with candidate_skill_codes and occupation_code parameters:
     [paste the full scoring Cypher from this PRD]
  4. Calculate normalized score (0-100)
  5. Return { score, matched_skills, gap_skills, candidate_skills_found }
```

**Prompt — Shortlisting Task:**
```
Create backend/app/tasks/shortlist_task.py with Celery task run_shortlisting.

Parameters: job_id, shortlist_count, task_db_id, recruiter_id (all strings).

Steps:
1. Update shortlist_tasks row status to 'running' in Supabase
2. Fetch all applications where job_id matches and eligibility_status='passed'
3. For each application: publish progress to Redis channel f"shortlist:{task_db_id}",
   download resume from Supabase Storage, call score_candidate()
4. Sort by score descending
5. Top shortlist_count → status='shortlisted', generate Gemini selection explanation
6. Rest → status='rejected', generate Gemini rejection explanation
7. Update all application rows in Supabase with status + score + explanation
8. Call send_emails_batch()
9. Update task status to 'done'

Handle exceptions per application (skip failed, continue with rest).
Use supabase_admin client. Import celery_app from app.tasks.celery_app.
```
