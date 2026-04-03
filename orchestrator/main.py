"""
RoadTrip Co-Pilot -- Orchestrator

Central hub: wallet auth, trip management, and voice pipeline
(STT -> Claude Code -> TTS).
"""

import asyncio
import logging
import os
import time

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import generate_nonce, verify_siwe, create_session, get_wallet_from_request
from db import init_db, get_or_create_user, log_conversation
from trips import router as trips_router

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

# --- Config ---
VOICE_VM_INTERNAL_IP = os.environ.get("VOICE_VM_INTERNAL_IP", "")
VOICE_API_KEY = os.environ.get("VOICE_API_KEY", "")
VOICE_CHANNEL_URL = os.environ.get("VOICE_CHANNEL_URL", "http://localhost:9000")
TTS_SERVICE_URL = os.environ.get("TTS_SERVICE_URL", "http://localhost:8000")
TTS_VOICE = os.environ.get("TTS_VOICE", "en_GB-cori-high")

START_TIME = time.time()


def voice_base_url() -> str:
    return f"http://{VOICE_VM_INTERNAL_IP}:8000" if VOICE_VM_INTERNAL_IP else ""


def voice_headers() -> dict:
    return {"Authorization": f"Bearer {VOICE_API_KEY}"} if VOICE_API_KEY else {}


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


async def _speech_to_text(base_url: str, audio_bytes: bytes, filename: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/v1/audio/transcriptions",
                headers=voice_headers(),
                files={"file": (filename, audio_bytes, "audio/wav")},
                data={"model": "Systran/faster-whisper-small"},
            )
            if resp.status_code != 200:
                raise Exception(f"STT returned {resp.status_code}")
            return resp.json().get("text", "").strip()
    except httpx.ConnectError:
        raise Exception("Voice VM unreachable")


async def _voice_channel_request(text: str, user_id: str, detail_level: str = "standard") -> str:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{TTS_SERVICE_URL}/v1/tts/stream",
                json={"text": text, "voice": TTS_VOICE, "speed": 1.0},
            )
            if resp.status_code != 200:
                raise Exception(f"TTS returned {resp.status_code}")
            sample_rate = int(resp.headers.get("X-Sample-Rate", "22050"))
            return _pcm_to_wav(resp.content, sample_rate=sample_rate)
    except httpx.ConnectError:
        raise Exception("TTS service unreachable")


@app.post("/v1/voice/converse")
async def voice_converse(
    audio: UploadFile = File(...),
    trip_id: int = Form(None),
    detail_level: str = Form("standard"),
    authorization: str = Header(None),
):
    wallet = get_wallet_from_request(authorization)
    if not wallet:
        raise HTTPException(status_code=401, detail="Not authenticated")

    base = voice_base_url()
    if not base:
        raise HTTPException(status_code=503, detail="Voice VM not configured")

    audio_bytes = await audio.read()
    filename = audio.filename or "audio.wav"

    # STT
    user_transcript = await _speech_to_text(base, audio_bytes, filename)
    if not user_transcript:
        raise HTTPException(status_code=400, detail="No speech detected")

    # Claude Code via voice channel
    assistant_text = await _voice_channel_request(user_transcript, wallet, detail_level)

    # TTS
    try:
        response_audio = await _text_to_speech(assistant_text)
    except Exception:
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


# --- Text converse (for web frontend without mic) ---

@app.post("/v1/text/converse")
async def text_converse(request: Request, authorization: str = Header(None)):
    wallet = get_wallet_from_request(authorization)
    if not wallet:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    text = body.get("text", "")
    trip_id = body.get("trip_id")

    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    assistant_text = await _voice_channel_request(text, wallet)

    if trip_id:
        log_conversation(trip_id, wallet, text, assistant_text, 0)

    return {"user_text": text, "assistant_text": assistant_text}
