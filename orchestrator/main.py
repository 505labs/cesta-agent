"""
RoadTrip Co-Pilot -- Orchestrator

Central hub: wallet auth, trip management, and voice pipeline
(STT -> Claude Code -> TTS).
"""

import asyncio
import logging
import os
import secrets
import time
from pathlib import Path

from dotenv import load_dotenv

# Load root .env (one level up from orchestrator/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import generate_nonce, verify_siwe, create_session, get_wallet_from_request
from db import init_db, get_or_create_user, log_conversation
from trips import router as trips_router
from sessions import router as sessions_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RoadTrip Co-Pilot Orchestrator", version="0.1.0")

# CORS for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount trip routes
app.include_router(trips_router)

# Mount session management routes
app.include_router(sessions_router)

# --- Config ---
# Core VM proxy (routes to voice VM internally)
CORE_VM_URL = os.environ.get("CORE_VM_URL", "http://34.134.200.237")
CORE_VM_API_KEY = os.environ.get("CORE_VM_API_KEY", "")
VOICE_CHANNEL_URL = os.environ.get("VOICE_CHANNEL_URL", "http://localhost:9000")
TTS_VOICE = os.environ.get("TTS_VOICE", "bf_emma")
TTS_SPEED = float(os.environ.get("TTS_SPEED", "1.1"))

START_TIME = time.time()


def voice_base_url() -> str:
    return CORE_VM_URL if CORE_VM_URL else ""


def voice_headers() -> dict:
    return {"Authorization": f"Bearer {CORE_VM_API_KEY}"} if CORE_VM_API_KEY else {}


@app.on_event("startup")
async def startup():
    init_db()
    logger.info("RoadTrip Co-Pilot orchestrator started")


# --- Health ---

@app.get("/health")
async def health():
    return {"status": "ok", "service": "roadtrip-orchestrator", "uptime_seconds": int(time.time() - START_TIME)}


# --- Auth Endpoints ---

@app.get("/v1/auth/nonce")
async def auth_nonce():
    return {"nonce": generate_nonce()}


@app.post("/v1/auth/verify")
async def auth_verify(request: Request):
    body = await request.json()
    message = body.get("message")
    signature = body.get("signature")
    if not message or not signature:
        raise HTTPException(status_code=400, detail="Missing message or signature")

    try:
        wallet_address = verify_siwe(message, signature)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Verification failed: {e}")

    get_or_create_user(wallet_address)
    token = create_session(wallet_address)
    return {"token": token, "wallet_address": wallet_address}


# --- Voice Pipeline (adapted from claude-superapp) ---

VOICE_POLL_INTERVAL = float(os.environ.get("VOICE_POLL_INTERVAL", "2.0"))
VOICE_POLL_TIMEOUT = float(os.environ.get("VOICE_POLL_TIMEOUT", "300.0"))

# --- Async voice request store (in-memory) ---
# Maps request_id -> {status, user_transcript, assistant_text, audio_bytes, error}
_async_requests: dict[str, dict] = {}


async def _speech_to_text(base_url: str, audio_bytes: bytes, filename: str) -> str:
    try:
        logger.info(f"STT: sending {len(audio_bytes)} bytes to {base_url}/v1/audio/transcriptions")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/v1/audio/transcriptions",
                headers=voice_headers(),
                files={"file": (filename, audio_bytes, "audio/wav")},
                data={"model": "Systran/faster-whisper-small"},
            )
            logger.info(f"STT response: status={resp.status_code}, body={resp.text[:500]}")
            if resp.status_code != 200:
                raise Exception(f"STT returned {resp.status_code}: {resp.text[:200]}")
            return resp.json().get("text", "").strip()
    except httpx.ConnectError:
        raise Exception("Voice VM unreachable")


async def _voice_channel_request(text: str, user_id: str, detail_level: str = "standard") -> str:
    try:
        # Voice channel holds the connection open until Claude responds (up to 10 min),
        # so the HTTP timeout must exceed the voice channel's own REQUEST_TIMEOUT_MS.
        async with httpx.AsyncClient(timeout=660.0) as client:
            resp = await client.post(
                f"{VOICE_CHANNEL_URL}/voice",
                json={"text": text, "user_id": user_id, "detail_level": detail_level, "type": "voice"},
            )
        if resp.status_code != 202 and resp.status_code != 200:
            return "I encountered an error submitting your request."

        data = resp.json()
        if "response" in data:
            return data["response"]

        request_id = data.get("request_id")
        if not request_id:
            return "I encountered an error."
    except (httpx.ConnectError, httpx.TimeoutException):
        return "The voice service is temporarily unavailable."

    # Poll for result
    deadline = time.time() + VOICE_POLL_TIMEOUT
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while time.time() < deadline:
                await asyncio.sleep(VOICE_POLL_INTERVAL)
                try:
                    poll_resp = await client.get(f"{VOICE_CHANNEL_URL}/voice/{request_id}")
                except (httpx.ConnectError, httpx.TimeoutException):
                    continue
                data = poll_resp.json()
                if data.get("status") == "completed":
                    return data.get("response", "")
                elif data.get("status") == "error":
                    return "The request timed out."
    except Exception:
        return "Error waiting for response."

    return "Request timed out."


def _pcm_to_wav(pcm_data: bytes, sample_rate: int = 22050) -> bytes:
    import struct
    data_size = len(pcm_data)
    byte_rate = sample_rate * 1 * 16 // 8
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, sample_rate, byte_rate, 2, 16,
        b"data", data_size,
    )
    return header + pcm_data


async def _text_to_speech(text: str) -> bytes:
    base = voice_base_url()
    if not base:
        raise Exception("Core VM not configured")
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{base}/v1/audio/speech",
                headers=voice_headers(),
                json={"input": text, "model": "speaches-ai/Kokoro-82M-v1.0-ONNX-fp16", "voice": TTS_VOICE, "speed": TTS_SPEED, "response_format": "wav"},
            )
            if resp.status_code != 200:
                raise Exception(f"TTS returned {resp.status_code}")
            # Speaches returns audio directly (wav/mp3), not raw PCM
            content_type = resp.headers.get("content-type", "")
            if "pcm" in content_type or "octet-stream" in content_type:
                sample_rate = int(resp.headers.get("X-Sample-Rate", "24000"))
                return _pcm_to_wav(resp.content, sample_rate=sample_rate)
            return resp.content
    except httpx.ConnectError:
        raise Exception("Core VM unreachable")


@app.post("/v1/voice/converse")
async def voice_converse(
    audio: UploadFile = File(...),
    trip_id: int = Form(None),
    detail_level: str = Form("standard"),
    authorization: str = Header(None),
):
    wallet = get_wallet_from_request(authorization) or "anonymous"

    base = voice_base_url()
    if not base:
        raise HTTPException(status_code=503, detail="Core VM not configured. Set CORE_VM_URL.")

    audio_bytes = await audio.read()
    filename = audio.filename or "audio.wav"
    logger.info(f"Voice converse: {len(audio_bytes)} bytes from {wallet}, trip_id={trip_id}")

    # STT
    try:
        user_transcript = await _speech_to_text(base, audio_bytes, filename)
    except Exception as e:
        logger.error(f"STT failed: {e}")
        raise HTTPException(status_code=502, detail=f"Speech-to-text failed: {e}")

    if not user_transcript:
        raise HTTPException(status_code=400, detail="No speech detected")
    logger.info(f"STT transcript: {user_transcript[:100]}")

    # Claude Code via voice channel
    try:
        assistant_text = await _voice_channel_request(user_transcript, wallet, detail_level)
    except Exception as e:
        logger.error(f"Voice channel failed: {e}")
        assistant_text = f"Sorry, I couldn't process that: {e}"
    logger.info(f"Assistant response: {assistant_text[:100]}")

    # TTS
    try:
        response_audio = await _text_to_speech(assistant_text)
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        # Return text-only if TTS fails
        return JSONResponse(content={
            "user_transcript": user_transcript,
            "assistant_text": assistant_text,
            "audio": None,
        })

    return Response(
        content=response_audio,
        media_type="audio/wav",
        headers={
            "X-User-Transcript": user_transcript[:200],
            "X-Trip-Id": str(trip_id or ""),
        },
    )


# --- Async voice submit + poll (for Android / long-running requests) ---

async def _process_voice_async(request_id: str, user_transcript: str, wallet: str, detail_level: str):
    """Background task: voice channel + TTS, stores result in _async_requests."""
    try:
        assistant_text = await _voice_channel_request(user_transcript, wallet, detail_level)
        logger.info(f"Async {request_id}: assistant response received ({len(assistant_text)} chars)")

        try:
            audio_bytes = await _text_to_speech(assistant_text)
        except Exception as e:
            logger.error(f"Async {request_id}: TTS failed: {e}")
            audio_bytes = None

        _async_requests[request_id].update({
            "status": "completed",
            "assistant_text": assistant_text,
            "audio_bytes": audio_bytes,
            "completed_at": time.time(),
        })
    except Exception as e:
        logger.error(f"Async {request_id}: processing failed: {e}")
        _async_requests[request_id].update({
            "status": "error",
            "error": str(e),
        })


@app.post("/v1/voice/submit")
async def voice_submit(
    audio: UploadFile = File(...),
    trip_id: int = Form(None),
    detail_level: str = Form("standard"),
    authorization: str = Header(None),
):
    """Accept audio, do STT, kick off async processing, return request_id immediately."""
    wallet = get_wallet_from_request(authorization) or "anonymous"

    base = voice_base_url()
    if not base:
        raise HTTPException(status_code=503, detail="Core VM not configured. Set CORE_VM_URL.")

    audio_bytes = await audio.read()
    filename = audio.filename or "audio.wav"
    logger.info(f"Voice submit: {len(audio_bytes)} bytes from {wallet}, trip_id={trip_id}")

    # STT (synchronous — fast enough to do inline)
    try:
        user_transcript = await _speech_to_text(base, audio_bytes, filename)
    except Exception as e:
        logger.error(f"STT failed: {e}")
        raise HTTPException(status_code=502, detail=f"Speech-to-text failed: {e}")

    if not user_transcript:
        raise HTTPException(status_code=400, detail="No speech detected")
    logger.info(f"STT transcript: {user_transcript[:100]}")

    # Generate request ID and store
    request_id = secrets.token_hex(12)
    _async_requests[request_id] = {
        "status": "processing",
        "user_transcript": user_transcript,
        "wallet": wallet,
        "trip_id": trip_id,
        "created_at": time.time(),
    }

    # Fire and forget background processing
    asyncio.create_task(_process_voice_async(request_id, user_transcript, wallet, detail_level))

    return JSONResponse(content={
        "request_id": request_id,
        "user_transcript": user_transcript,
        "status": "processing",
    })


@app.get("/v1/voice/{request_id}")
async def voice_poll(request_id: str):
    """Poll for async voice result. Returns audio/wav when completed."""
    entry = _async_requests.get(request_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Unknown request_id")

    status = entry["status"]

    if status == "processing":
        elapsed = int(time.time() - entry.get("created_at", time.time()))
        return JSONResponse(content={"status": "processing", "elapsed_seconds": elapsed})

    if status == "error":
        return JSONResponse(content={"status": "error", "error": entry.get("error", "Unknown error")}, status_code=200)

    # status == "completed"
    audio_bytes = entry.get("audio_bytes")
    assistant_text = entry.get("assistant_text", "")
    user_transcript = entry.get("user_transcript", "")

    if audio_bytes:
        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "X-User-Transcript": user_transcript[:200],
                "X-Assistant-Text": assistant_text[:500],
                "X-Status": "completed",
            },
        )
    else:
        # TTS failed — return text only
        return JSONResponse(content={
            "status": "completed",
            "user_transcript": user_transcript,
            "assistant_text": assistant_text,
        })


# --- Text converse (for web frontend without mic) ---

@app.post("/v1/text/converse")
async def text_converse(request: Request, authorization: str = Header(None)):
    wallet = get_wallet_from_request(authorization) or "anonymous"

    body = await request.json()
    text = body.get("text", "")
    trip_id = body.get("trip_id")

    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    assistant_text = await _voice_channel_request(text, wallet)

    if trip_id:
        log_conversation(trip_id, wallet, text, assistant_text, 0)

    return {"user_text": text, "assistant_text": assistant_text}
