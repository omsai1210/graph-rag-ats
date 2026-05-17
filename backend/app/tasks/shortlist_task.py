import json
from datetime import datetime
from celery import shared_task
from neo4j import GraphDatabase
import redis

from app.core.config import settings
from app.services.supabase import supabase_admin
from app.services.resume_upload import get_resume_bytes
from app.services.gemini import generate_selection_explanation, generate_rejection_explanation
from app.services.email import send_selection_email, send_rejection_email
from app.graph.rag_chain import score_candidate
from app.tasks.celery_app import celery_app

redis_client = redis.from_url(settings.redis_url)

@celery_app.task(bind=True, name="shortlist_task")
def run_shortlisting(self, job_id: str, shortlist_count: int,
                     task_db_id: str, recruiter_id: str):

    def publish_progress(current: int, total: int, name: str, status: str = "processing"):
        redis_client.publish(
            f"shortlist:{task_db_id}",
            json.dumps({
                "current": current,
                "total": total,
                "name": name,
                "status": status,
                "percent": round((current / total) * 100) if total > 0 else 0
            })
        )

    try:
        # Step 1: Mark task as running
        supabase_admin.table("shortlist_tasks").update({
            "status": "running",
            "celery_task_id": self.request.id,
            "started_at": datetime.utcnow().isoformat()
        }).eq("id", task_db_id).execute()

        # Step 2: Fetch job details
        job_resp = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute()
        job = job_resp.data
        occupation_code = job.get("esco_occupation_code")

        if not occupation_code:
            raise ValueError("Job has no ESCO occupation code set. Cannot run Graph RAG scoring.")

        # Step 3: Fetch all eligible applications
        apps_resp = supabase_admin.table("applications").select("*").eq(
            "job_id", job_id
        ).eq("eligibility_status", "passed").eq("shortlist_status", "pending").execute()
        apps = apps_resp.data

        if not apps:
            supabase_admin.table("shortlist_tasks").update({
                "status": "done",
                "completed_at": datetime.utcnow().isoformat()
            }).eq("id", task_db_id).execute()
            redis_client.publish(f"shortlist:{task_db_id}", json.dumps({
                "status": "done", "current": 0, "total": 0,
                "message": "No pending eligible applications to process."
            }))
            return

        total = len(apps)
        scores = []

        # Step 4: Score each candidate
        for i, app in enumerate(apps):
            try:
                publish_progress(i + 1, total, app["full_name"])

                if not app.get("resume_path"):
                    continue

                import asyncio
                resume_bytes = asyncio.run(get_resume_bytes(app["resume_path"]))
                result = score_candidate(resume_bytes, occupation_code)

                scores.append({
                    "application_id": app["id"],
                    "email": app["email"],
                    "full_name": app["full_name"],
                    "score": result["score"],
                    "matched_skills": result["matched_skills"],
                    "gap_skills": result["gap_skills"],
                    "error": result.get("error")
                })

            except Exception as e:
                print(f"Failed to score {app['full_name']}: {e}")
                scores.append({
                    "application_id": app["id"],
                    "email": app["email"],
                    "full_name": app["full_name"],
                    "score": 0.0,
                    "matched_skills": [],
                    "gap_skills": [],
                    "error": str(e)
                })
                continue

        # Step 5: Sort by score descending
        scores.sort(key=lambda x: x["score"], reverse=True)

        shortlisted = scores[:shortlist_count]
        rejected = scores[shortlist_count:]

        # Step 6: Update shortlisted candidates
        for s in shortlisted:
            explanation = generate_selection_explanation(
                s["full_name"], job["title"], s["score"], s["matched_skills"]
            )
            supabase_admin.table("applications").update({
                "shortlist_status": "shortlisted",
                "graph_rag_score": s["score"],
                "graph_rag_explanation": explanation
            }).eq("id", s["application_id"]).execute()

            send_selection_email(
                s["email"], s["full_name"], job["title"], explanation, s["score"]
            )

        # Step 7: Update rejected candidates
        for r in rejected:
            explanation = generate_rejection_explanation(
                r["full_name"], job["title"], r["score"], r["gap_skills"]
            )
            supabase_admin.table("applications").update({
                "shortlist_status": "rejected",
                "graph_rag_score": r["score"],
                "graph_rag_explanation": explanation
            }).eq("id", r["application_id"]).execute()

            send_rejection_email(
                r["email"], r["full_name"], job["title"], explanation, r["score"]
            )

        # Step 8: Mark task complete
        supabase_admin.table("shortlist_tasks").update({
            "status": "done",
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", task_db_id).execute()

        publish_progress(total, total, "Complete", status="done")

    except Exception as e:
        supabase_admin.table("shortlist_tasks").update({
            "status": "failed"
        }).eq("id", task_db_id).execute()
        redis_client.publish(f"shortlist:{task_db_id}", json.dumps({
            "status": "failed", "message": str(e)
        }))
        raise
