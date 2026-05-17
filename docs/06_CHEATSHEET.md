# Graph RAG ATS — Quick Reference Cheatsheet

## Start Local Dev (Every Session)

```bash
# Terminal 1 — FastAPI backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Celery worker
cd backend && source .venv/bin/activate
celery -A app.tasks.celery_app worker --loglevel=info

# API docs available at:
# http://localhost:8000/docs
```

---

## Git Commands You'll Use Daily

```bash
git status                          # see what's changed
git add .                           # stage all
git commit -m "feat(module): msg"   # commit
git push origin feature/branch-name # push
git checkout develop && git pull    # sync develop
git checkout -b feature/new-thing   # new feature branch
```

---

## Supabase SQL Snippets (Run in SQL Editor)

```sql
-- See all applications for a job
SELECT a.*, j.title FROM applications a
JOIN jobs j ON a.job_id = j.id
WHERE j.title ILIKE '%developer%';

-- See shortlisting task status
SELECT * FROM shortlist_tasks ORDER BY created_at DESC LIMIT 10;

-- Reset a shortlist (for testing)
UPDATE applications SET shortlist_status='pending', graph_rag_score=NULL
WHERE job_id='your-job-uuid';
```

---

## Neo4j Cypher Snippets (Run in AuraDB Browser)

```cypher
// Check ESCO data loaded correctly
MATCH (o:Occupation) RETURN count(o) AS occupation_count;
MATCH (s:Skill) RETURN count(s) AS skill_count;
MATCH ()-[r:REQUIRES]->() RETURN count(r) AS relation_count;

// Find skills for a specific occupation
MATCH (o:Occupation {label: "Software Developer"})-[:REQUIRES]->(s:Skill)
RETURN o.label, s.label, s.skillType LIMIT 20;

// Search for a skill by name
MATCH (s:Skill) WHERE s.label CONTAINS "Python"
RETURN s.escoCode, s.label LIMIT 5;

// Test 2-hop traversal
MATCH (s1:Skill)-[:BROADER*1..2]->(s2:Skill)
WHERE s2.label = "Programming"
RETURN s1.label, s2.label LIMIT 10;
```

---

## Environment Variables Summary

| Variable | Where to get it |
|---|---|
| SUPABASE_URL | Supabase dashboard → Settings → API |
| SUPABASE_ANON_KEY | Supabase dashboard → Settings → API |
| SUPABASE_SERVICE_ROLE_KEY | Supabase dashboard → Settings → API |
| NEO4J_URI | Neo4j AuraDB console → instance details |
| NEO4J_USERNAME | Always `neo4j` |
| NEO4J_PASSWORD | Shown once at AuraDB instance creation |
| REDIS_URL | Redis Cloud → database → connection string |
| GEMINI_API_KEY | aistudio.google.com → Get API key |
| RESEND_API_KEY | resend.com → API Keys |
| RESEND_FROM_EMAIL | Your verified sending domain |
| SECRET_KEY | Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |

---

## PRD Files Index

| File | Covers |
|---|---|
| `00_SETUP_GUIDE.md` | Accounts, Git setup, Python env, all service configs |
| `01_PRD_OVERVIEW.md` | Full system overview, workflows, API table, folder structure |
| `02_PRD_BACKEND_AUTH.md` | FastAPI scaffold, config, security, auth routes |
| `03_PRD_JOBS_APPLICATIONS.md` | Job CRUD, application submit, eligibility check, resume upload |
| `04_PRD_GRAPHRAG_SHORTLIST_EMAIL.md` | ESCO import, Graph RAG scoring, Celery task, Gemini, Resend |
| `05_PRD_FRONTEND_STITCH.md` | Candidate portal, Recruiter portal, Stitch prompts, deployment |
| `06_CHEATSHEET.md` | This file |

---

## Build Order Reminder

```
1. Accounts + GitHub repo (00_SETUP_GUIDE.md Phase 0-1)
2. Python env + .env file (Phase 2)
3. Supabase tables + storage bucket (Phase 3)
4. Neo4j AuraDB instance (Phase 4)
5. Redis Cloud + Gemini + Resend accounts (Phase 5-7)
6. Backend scaffold + auth (02_PRD_BACKEND_AUTH.md)
7. Jobs + Applications APIs (03_PRD_JOBS_APPLICATIONS.md)
8. ESCO import script → run it (04_PRD_GRAPHRAG_SHORTLIST_EMAIL.md Module 4)
9. Graph RAG scoring chain (Module 5)
10. Celery shortlisting task (Module 6)
11. Gemini + Resend email (Module 7)
12. Candidate frontend in Stitch (05_PRD_FRONTEND_STITCH.md Module 8)
13. Recruiter frontend in Stitch (Module 9)
14. Deploy backend to Railway
```

---

## Common Errors and Fixes

| Error | Fix |
|---|---|
| `neo4j.exceptions.AuthError` | Check NEO4J_PASSWORD in .env — copy fresh from AuraDB console |
| `StorageException: Bucket not found` | Create 'resumes' bucket in Supabase Storage |
| `celery.exceptions.NotRegistered` | Make sure celery worker is running in a separate terminal |
| `413 Request Entity Too Large` | Resume > 5MB — check Supabase bucket size limit |
| `422 Unprocessable Entity` | Pydantic validation failed — check request body matches model |
| ESCO import too slow | Normal on free tier — let it run, takes 10-15 min |
| Gemini API quota exceeded | Switch to gemini-1.5-flash model in gemini.py |
