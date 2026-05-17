"""
Resume upload / download helpers using Supabase Storage.

Bucket: resumes
Path format: {job_id}/{application_id}.pdf
"""

from __future__ import annotations

from app.services.supabase import supabase_admin


async def upload_resume(file_bytes: bytes, job_id: str, application_id: str) -> str:
    """
    Uploads a resume PDF to the Supabase Storage 'resumes' bucket.

    Args:
        file_bytes:      Raw PDF bytes from the uploaded file.
        job_id:          UUID of the job (used as a folder prefix).
        application_id:  UUID of the application (filename).

    Returns:
        The storage path string: "{job_id}/{application_id}.pdf"
    """
    path = f"{job_id}/{application_id}.pdf"
    supabase_admin.storage.from_("resumes").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    return path


async def get_resume_bytes(path: str) -> bytes:
    """
    Downloads a resume PDF from Supabase Storage.

    Args:
        path:  Storage path in the format returned by upload_resume.

    Returns:
        Raw PDF bytes.
    """
    response = supabase_admin.storage.from_("resumes").download(path)
    return response
