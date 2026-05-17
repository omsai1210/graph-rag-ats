"""
Supabase client factory — lazy initialization.

supabase-py v2 has a bug where `create_client(...).auth.admin` builds its URL
as `<project-url>/rest/v1/auth/v1` (double-nested).  We work around this by
constructing the SyncGoTrueAdminAPI directly with the correct Auth base URL.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from supabase import Client
    from supabase_auth import SyncGoTrueAdminAPI


# ---------------------------------------------------------------------------
# Regular (anon) client – respects Row Level Security
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_supabase_client() -> "Client":
    from supabase import create_client
    from app.core.config import settings
    return create_client(settings.supabase_url, settings.supabase_anon_key)


# ---------------------------------------------------------------------------
# Admin (service-role) client – bypasses RLS
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_supabase_admin() -> "Client":
    from supabase import create_client
    from app.core.config import settings
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# ---------------------------------------------------------------------------
# Direct Admin Auth API – avoids the double-path bug in supabase-py v2
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_admin_auth() -> "SyncGoTrueAdminAPI":
    """
    Build a SyncGoTrueAdminAPI pointed at the correct /auth/v1 endpoint,
    bypassing the supabase-py bug that produces /rest/v1/auth/v1.
    """
    from supabase_auth import SyncGoTrueAdminAPI
    from app.core.config import settings

    auth_url = f"{settings.supabase_url.rstrip('/')}/auth/v1"
    headers = {
        "apiKey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
    }
    return SyncGoTrueAdminAPI(url=auth_url, headers=headers)


# ---------------------------------------------------------------------------
# Lazy proxy
# ---------------------------------------------------------------------------

class _LazyClient:
    """Transparent proxy that forwards attribute access to the real client."""
    def __init__(self, factory):
        object.__setattr__(self, "_factory", factory)

    def __getattr__(self, item):
        return getattr(object.__getattribute__(self, "_factory")(), item)


# Public singletons – safe to import at module level
supabase_client: "Client" = _LazyClient(_get_supabase_client)   # type: ignore[assignment]
supabase_admin: "Client"  = _LazyClient(_get_supabase_admin)    # type: ignore[assignment]
admin_auth: "SyncGoTrueAdminAPI" = _LazyClient(_get_admin_auth) # type: ignore[assignment]
