"""
Session management proxy endpoints.

Proxies session CRUD to the session-manager service on the VM.
Matches the claude-superapp orchestrator API format for Android app compatibility.
"""

import os
import time

import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse

SESSION_MANAGER_URL = os.environ.get("SESSION_MANAGER_URL", "http://localhost:9001")
VOICE_CHANNEL_URL = os.environ.get("VOICE_CHANNEL_URL", "http://localhost:9000")

router = APIRouter()


async def _proxy(method: str, path: str, body: dict | None = None, timeout: float = 10.0) -> JSONResponse:
    """Proxy a request to the session manager."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if method == "GET":
                resp = await client.get(f"{SESSION_MANAGER_URL}{path}")
            elif method == "POST":
                resp = await client.post(f"{SESSION_MANAGER_URL}{path}", json=body)
            elif method == "DELETE":
                resp = await client.delete(f"{SESSION_MANAGER_URL}{path}")
            else:
                return JSONResponse(status_code=405, content={"detail": f"Unsupported method: {method}"})

            if resp.status_code == 204:
                return Response(status_code=204)
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except (httpx.ConnectError, httpx.TimeoutException):
        return JSONResponse(status_code=503, content={"detail": "Session manager unavailable"})


# --- Session CRUD ---

@router.get("/api/sessions")
async def list_sessions():
    return await _proxy("GET", "/sessions")


@router.post("/api/sessions")
async def create_session(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"detail": "Invalid JSON body"})
    return await _proxy("POST", "/sessions", body)


@router.post("/api/sessions/{session_id}/activate")
async def activate_session(session_id: int):
    return await _proxy("POST", f"/sessions/{session_id}/activate", timeout=30.0)


@router.post("/api/sessions/{session_id}/stop")
async def stop_session(session_id: int):
    return await _proxy("POST", f"/sessions/{session_id}/stop")


@router.post("/api/sessions/{session_id}/close")
async def close_session(session_id: int):
    return await _proxy("POST", f"/sessions/{session_id}/close")


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: int):
    return await _proxy("DELETE", f"/sessions/{session_id}")


# --- Status ---

@router.get("/api/status")
async def api_status():
    """Combined health status of all services."""
    from main import voice_base_url, voice_headers, START_TIME

    # Check voice VM (STT/TTS)
    voice_ok = False
    base = voice_base_url()
    if base:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{base}/v1/models", headers=voice_headers())
                voice_ok = resp.status_code == 200
        except Exception:
            pass

    # Check voice channel
    vc_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{VOICE_CHANNEL_URL}/health")
            vc_ok = resp.status_code == 200
    except Exception:
        pass

    # Check session manager
    sm_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{SESSION_MANAGER_URL}/health")
            sm_ok = resp.status_code == 200
    except Exception:
        pass

    return {
        "orchestrator": "running",
        "voice_agent": "running" if voice_ok else "stopped",
        "voice_channel": "running" if vc_ok else "stopped",
        "session_manager": "running" if sm_ok else "stopped",
        "uptime_seconds": int(time.time() - START_TIME),
    }


# --- Conversations ---

@router.get("/api/conversations")
async def api_conversations():
    """Get recent conversation history."""
    from db import get_db

    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM conversations ORDER BY created_at DESC LIMIT 50"
        ).fetchall()
        return {"conversations": [dict(r) for r in rows]}
