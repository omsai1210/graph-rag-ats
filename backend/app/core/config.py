from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve .env relative to this file (backend/app/core/config.py → project root)
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Neo4j
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str

    # Redis / Celery
    redis_url: str

    # Gemini (Google AI)
    gemini_api_key: str

    # Gmail (email)
    gmail_user: str
    gmail_app_password: str

    # JWT / general security
    secret_key: str

    # Runtime environment
    environment: str = "development"
    allowed_origins: str = "*"

    model_config = {"env_file": str(_ENV_FILE)}


# Singleton instance used throughout the application
settings = Settings()
