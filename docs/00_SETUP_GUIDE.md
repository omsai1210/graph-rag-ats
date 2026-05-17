# Graph RAG ATS — Complete Setup Guide

## Phase 0 — Accounts to Open (Do This First)

Open all these accounts before writing a single line of code. All have free tiers sufficient to start.

| Service | Purpose | URL | Free Tier |
|---|---|---|---|
| GitHub | Code hosting + version control | github.com | Unlimited public/private repos |
| Supabase | Postgres DB + Auth + File Storage | supabase.com | 500MB DB, 1GB storage |
| Neo4j AuraDB | Graph database (ESCO + skills graph) | console.neo4j.io | 1 free AuraDB Free instance |
| Redis Cloud | Celery task queue broker | redis.io/try-free | 30MB free |
| Google AI Studio | Gemini API key | aistudio.google.com | Free quota |
| Resend | Transactional email (selection/rejection) | resend.com | 3,000 emails/month free |
| Railway | FastAPI backend deployment | railway.app | $5 credit free |
| Google Stitch | Frontend UI builder | stitch.google.com | — |
| Antigravity | AI-powered IDE | — | — |

---

## Phase 1 — GitHub Repository Setup

### 1.1 Create the repository on GitHub

1. Go to github.com → click **New repository**
2. Name: `graph-rag-ats`
3. Visibility: Private
4. Add README: yes
5. Add .gitignore: Python
6. Click **Create repository**

### 1.2 Clone and set up local structure

```bash
git clone https://github.com/YOUR_USERNAME/graph-rag-ats.git
cd graph-rag-ats
```

### 1.3 Create the full folder structure

```bash
mkdir -p backend/app/{api,core,models,services,graph,tasks,utils}
mkdir -p backend/app/api/{routes,dependencies}
mkdir -p backend/scripts
mkdir -p backend/tests
mkdir -p data/esco
mkdir -p docs
touch backend/app/__init__.py
touch backend/app/api/__init__.py
touch backend/app/api/routes/__init__.py
touch backend/app/core/__init__.py
touch backend/app/models/__init__.py
touch backend/app/services/__init__.py
touch backend/app/graph/__init__.py
touch backend/app/tasks/__init__.py
touch backend/app/utils/__init__.py
touch backend/.env.example
touch backend/requirements.txt
touch backend/main.py
touch README.md
```

### 1.4 Create .gitignore additions

```bash
cat >> .gitignore << 'EOF'
# Environment
.env
.env.local
*.env

# Python
__pycache__/
*.pyc
*.pyo
.venv/
venv/
*.egg-info/

# Data
data/esco/*.csv
data/esco/*.zip

# IDE
.vscode/
.idea/

# Logs
*.log
celerybeat-schedule
EOF
```

### 1.5 Initial commit

```bash
git add .
git commit -m "feat: initial project scaffold"
git push origin main
```

### 1.6 Create branches

```bash
git checkout -b develop
git push origin develop

git checkout -b feature/backend-setup
git push origin feature/backend-setup
```

**Branch strategy going forward:**
- `main` — production only
- `develop` — integration branch
- `feature/*` — one per module (auth, jobs, resume-upload, graph-rag, shortlisting, email)

---

## Phase 2 — Backend Python Environment

### 2.1 Create virtual environment

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Mac/Linux
# .venv\Scripts\activate    # Windows
```

### 2.2 Install all dependencies

```bash
pip install \
  fastapi==0.111.0 \
  uvicorn[standard]==0.30.1 \
  python-multipart==0.0.9 \
  python-jose[cryptography]==3.3.0 \
  passlib[bcrypt]==1.7.4 \
  pydantic==2.7.1 \
  pydantic-settings==2.2.1 \
  supabase==2.4.3 \
  neo4j==5.20.0 \
  langchain==0.2.1 \
  langchain-community==0.2.1 \
  langchain-google-genai==1.0.5 \
  google-generativeai==0.7.2 \
  celery==5.4.0 \
  redis==5.0.4 \
  unstructured[pdf]==0.14.6 \
  pymupdf==1.24.5 \
  python-dotenv==1.0.1 \
  httpx==0.27.0 \
  resend==2.1.0 \
  pandas==2.2.2 \
  tqdm==4.66.4 \
  pytest==8.2.1 \
  pytest-asyncio==0.23.7
```

### 2.3 Freeze requirements

```bash
pip freeze > requirements.txt
```

### 2.4 Create .env file (never commit this)

```bash
cat > .env << 'EOF'
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Neo4j AuraDB
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# Redis
REDIS_URL=redis://default:password@redis-host:port

# Gemini
GEMINI_API_KEY=your-gemini-key

# Resend (email)
RESEND_API_KEY=re_your-key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App
SECRET_KEY=your-32-char-secret-for-jwt
ENVIRONMENT=development
EOF
```

Copy .env.example for teammates:

```bash
cat > .env.example << 'EOF'
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEO4J_URI=
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=
REDIS_URL=
GEMINI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
SECRET_KEY=
ENVIRONMENT=development
EOF
```

---

## Phase 3 — Supabase Setup

### 3.1 Create project

1. supabase.com → New project
2. Name: `graph-rag-ats`
3. Database password: save this securely
4. Region: pick closest to you

### 3.2 Create database tables (run in Supabase SQL editor)

```sql
-- Recruiters/HR table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('recruiter', 'candidate')) not null,
  email text,
  created_at timestamptz default now()
);

-- Jobs table
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  requirements jsonb not null default '{}',
  esco_occupation_code text,
  recruiter_id uuid references public.profiles(id),
  max_applicants integer default 100,
  deadline timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Eligibility filters per job
create table public.job_eligibility (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  gender_allowed text[] default array['male','female','other'],
  branches_allowed text[],
  min_cgpa numeric(4,2),
  graduation_years int[],
  created_at timestamptz default now()
);

-- Applications table
create table public.applications (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id),
  candidate_id uuid references public.profiles(id),
  resume_path text,
  full_name text not null,
  email text not null,
  phone text,
  branch text,
  graduation_year integer,
  cgpa numeric(4,2),
  gender text,
  eligibility_status text check (eligibility_status in ('pending','passed','failed')) default 'pending',
  shortlist_status text check (shortlist_status in ('pending','shortlisted','rejected')) default 'pending',
  graph_rag_score numeric(5,2),
  graph_rag_explanation text,
  applied_at timestamptz default now()
);

-- Shortlisting jobs (async task tracking)
create table public.shortlist_tasks (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id),
  requested_by uuid references public.profiles(id),
  shortlist_count integer not null,
  status text check (status in ('queued','running','done','failed')) default 'queued',
  celery_task_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

create policy "Candidates see their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Recruiters see all jobs" on public.jobs
  for select using (true);

create policy "Recruiters manage their jobs" on public.jobs
  for all using (auth.uid() = recruiter_id);

create policy "Candidates see their applications" on public.applications
  for select using (auth.uid() = candidate_id);

create policy "Recruiters see applications for their jobs" on public.applications
  for select using (
    exists (select 1 from public.jobs where id = job_id and recruiter_id = auth.uid())
  );
```

### 3.3 Create Supabase Storage bucket

1. Supabase dashboard → Storage → New bucket
2. Name: `resumes`
3. Public: NO (private bucket)
4. File size limit: 5MB
5. Allowed MIME types: `application/pdf`

---

## Phase 4 — Neo4j AuraDB Setup

### 4.1 Create free instance

1. console.neo4j.io → Create instance
2. Choose **AuraDB Free**
3. Name: `ats-graph`
4. Region: closest to you
5. Download the credentials file when shown — you only see the password once

### 4.2 Download ESCO taxonomy data

1. Go to: `https://esco.ec.europa.eu/en/use-esco/download`
2. Download: **ESCO dataset v1.2** → CSV format
3. Extract to `data/esco/` in your project
4. Key files you'll use:
   - `occupations_en.csv` — ~3,000 occupations
   - `skills_en.csv` — ~14,000 skills/competences
   - `occupationSkillRelations.csv` — maps occupations to skills
   - `skillsHierarchy_en.csv` — skill parent/child tree

### 4.3 ESCO import script (run once)

```bash
# Run after backend environment is set up
python backend/scripts/import_esco.py
```

This script is defined in the backend PRD. It will:
- Create (:Occupation) nodes
- Create (:Skill) nodes
- Create [:REQUIRES] relationships
- Create [:BROADER] hierarchy relationships
- Takes ~10-15 minutes on free tier

---

## Phase 5 — Redis Cloud Setup

1. redis.io/try-free → Create free database
2. Name: `ats-queue`
3. Copy the connection string (format: `redis://default:password@host:port`)
4. Paste into `.env` as `REDIS_URL`

---

## Phase 6 — Gemini API Setup

1. aistudio.google.com → Get API key
2. Create new project or use existing
3. Copy key → paste into `.env` as `GEMINI_API_KEY`
4. Model to use: `gemini-1.5-pro` for shortlist explanation, `gemini-1.5-flash` for faster tasks

---

## Phase 7 — Resend Email Setup

1. resend.com → Sign up → Add API key
2. Dashboard → API Keys → Create API key
3. Paste into `.env` as `RESEND_API_KEY`
4. Add and verify your sending domain (or use onboarding@resend.dev for testing)

---

## Phase 8 — Git Workflow for Building Features

For each new module follow this pattern:

```bash
# Start a new feature
git checkout develop
git pull origin develop
git checkout -b feature/MODULE-NAME

# Work on code...

# Commit regularly
git add .
git commit -m "feat(module): what you did"

# Push and open PR to develop
git push origin feature/MODULE-NAME
# GitHub → open Pull Request → base: develop
```

### Commit message convention

```
feat(auth): add recruiter login endpoint
feat(jobs): job post creation with eligibility filters
feat(resume): file upload to Supabase storage
feat(graph): ESCO import script
feat(rag): LangChain Graph RAG scoring chain
feat(shortlist): Celery async shortlisting task
feat(email): Gemini + Resend selection email
fix(api): handle resume parse error gracefully
```

---

## Build Order (Follow This Sequence)

| # | Module | Branch | Estimated Sessions |
|---|---|---|---|
| 1 | Backend scaffold + config | `feature/backend-setup` | 1 |
| 2 | Supabase auth (recruiter + candidate) | `feature/auth` | 1 |
| 3 | Job posting CRUD | `feature/jobs` | 1 |
| 4 | Resume upload + eligibility check | `feature/resume-upload` | 2 |
| 5 | ESCO Neo4j import | `feature/esco-import` | 1 |
| 6 | Graph RAG scoring chain | `feature/graph-rag` | 2 |
| 7 | Celery async shortlisting | `feature/shortlisting` | 1 |
| 8 | Gemini explanation + Resend email | `feature/email` | 1 |
| 9 | Google Stitch frontend — Candidate | `feature/frontend-candidate` | 2 |
| 10 | Google Stitch frontend — Recruiter | `feature/frontend-recruiter` | 2 |
| 11 | Railway deployment | `feature/deployment` | 1 |
