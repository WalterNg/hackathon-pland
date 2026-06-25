from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote

import httpx

from core.config import settings


class SupabaseRestError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


def _normalized_supabase_url() -> str:
    base_url = settings.supabase_url.strip()
    if not base_url:
        raise SupabaseRestError("Supabase URL is missing.", status_code=500)
    if not base_url.startswith("http"):
        base_url = f"https://{base_url}"
    return base_url.rstrip("/")


def _require_service_role_key() -> str:
    key = settings.supabase_service_role_key.strip()
    if not key:
        raise SupabaseRestError("Supabase service role key is missing.", status_code=500)
    return key


def _require_anon_key() -> str:
    key = settings.supabase_anon_key.strip()
    if not key:
        raise SupabaseRestError("Supabase anon key is missing.", status_code=500)
    return key


def build_filter_eq(column: str, value: str) -> str:
    return f"{column}=eq.{quote(str(value), safe='')}"


def build_filter_is_null(column: str) -> str:
    return f"{column}=is.null"


def build_filter_select(columns: str) -> str:
    return f"select={quote(columns, safe='(),*')}"


def build_filter_limit(limit: int) -> str:
    return f"limit={int(limit)}"


def build_filter_order(column: str, ascending: bool = True) -> str:
    direction = "asc" if ascending else "desc"
    return f"order={quote(f'{column}.{direction}', safe='.')}"


def build_filter_in(column: str, values: list[str]) -> str:
    inner = ",".join(str(v) for v in values)
    return f"{column}=in.({quote(inner, safe=',.')})"


async def _request_json(
    method: str,
    path: str,
    *,
    headers: dict[str, str],
    params: list[str] | None = None,
    json_body: Any | None = None,
) -> Any:
    query_string = f"?{'&'.join(params)}" if params else ""
    url = f"{_normalized_supabase_url()}{path}{query_string}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.request(method, url, headers=headers, json=json_body)

    if response.status_code >= 400:
        detail = response.text.strip() or f"Supabase request failed with status {response.status_code}."
        raise SupabaseRestError(detail, status_code=response.status_code)

    if not response.text.strip():
        return None

    try:
        return response.json()
    except json.JSONDecodeError as exc:
        raise SupabaseRestError("Supabase returned an invalid JSON payload.", status_code=502) from exc


def service_role_headers(*, prefer: str | None = None) -> dict[str, str]:
    service_role_key = _require_service_role_key()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def bearer_headers(access_token: str) -> dict[str, str]:
    anon_key = _require_anon_key()
    token = access_token.strip()
    if not token:
        raise SupabaseRestError("Missing bearer token.", status_code=401)

    return {
        "apikey": anon_key,
        "Authorization": f"Bearer {token}",
    }


async def fetch_authenticated_user(access_token: str) -> dict[str, Any] | None:
    payload = await _request_json(
        "GET",
        "/auth/v1/user",
        headers=bearer_headers(access_token),
    )
    return payload if isinstance(payload, dict) else None


async def select_rows(
    table: str,
    *,
    params: list[str],
    single: bool = False,
) -> list[dict[str, Any]] | dict[str, Any] | None:
    payload = await _request_json(
        "GET",
        f"/rest/v1/{table}",
        headers=service_role_headers(),
        params=params,
    )

    if single:
        if isinstance(payload, list):
            return payload[0] if payload else None
        return payload if isinstance(payload, dict) else None

    return payload if isinstance(payload, list) else []


async def insert_row(table: str, row: dict[str, Any]) -> dict[str, Any] | None:
    payload = await _request_json(
        "POST",
        f"/rest/v1/{table}",
        headers=service_role_headers(prefer="return=representation"),
        json_body=row,
    )
    if isinstance(payload, list):
        return payload[0] if payload else None
    return payload if isinstance(payload, dict) else None


async def update_rows(
    table: str,
    *,
    params: list[str],
    updates: dict[str, Any],
    single: bool = False,
) -> list[dict[str, Any]] | dict[str, Any] | None:
    payload = await _request_json(
        "PATCH",
        f"/rest/v1/{table}",
        headers=service_role_headers(prefer="return=representation"),
        params=params,
        json_body=updates,
    )

    if single:
        if isinstance(payload, list):
            return payload[0] if payload else None
        return payload if isinstance(payload, dict) else None

    return payload if isinstance(payload, list) else []
