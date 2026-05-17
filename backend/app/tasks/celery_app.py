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
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)
