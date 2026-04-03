# Orchestrator

FastAPI backend for RoadTrip Co-Pilot. Handles wallet auth (SIWE), trip management, and the voice pipeline (STT -> Claude Code -> TTS).

## Setup
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Run
```bash
uvicorn main:app --reload --port 8080
```

## Test
```bash
pytest tests/ -v
```

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| GET | /v1/auth/nonce | No | Get SIWE nonce |
| POST | /v1/auth/verify | No | Verify SIWE signature, get session |
| POST | /v1/trips | Yes | Create a trip |
| GET | /v1/trips | Yes | List my trips |
| GET | /v1/trips/:id | Yes | Get trip details |
| POST | /v1/trips/:id/join | Yes | Join a trip |
| POST | /v1/voice/converse | Yes | Voice pipeline (audio in -> audio out) |
| POST | /v1/text/converse | Yes | Text pipeline (text in -> text out) |
