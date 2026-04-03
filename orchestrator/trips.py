"""Trip management endpoints."""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from auth import get_wallet_from_request
from db import create_trip, get_trip, list_trips, add_trip_member, get_trip_members

router = APIRouter(prefix="/v1/trips", tags=["trips"])


class CreateTripRequest(BaseModel):
    name: str
    spend_limit_usd: float = 100.0
    contract_trip_id: int | None = None
    treasury_address: str | None = None


class JoinTripRequest(BaseModel):
    display_name: str = ""


def _require_wallet(authorization: str | None) -> str:
    wallet = get_wallet_from_request(authorization)
    if not wallet:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return wallet


@router.post("")
async def create_trip_endpoint(body: CreateTripRequest, authorization: str = Header(None)):
    wallet = _require_wallet(authorization)
    trip = create_trip(
        name=body.name,
        organizer_wallet=wallet,
        contract_trip_id=body.contract_trip_id,
        treasury_address=body.treasury_address,
        spend_limit_usd=body.spend_limit_usd,
    )
    return trip


@router.get("")
async def list_trips_endpoint(authorization: str = Header(None)):
    wallet = _require_wallet(authorization)
    return list_trips(wallet)


@router.get("/{trip_id}")
async def get_trip_endpoint(trip_id: int, authorization: str = Header(None)):
    wallet = _require_wallet(authorization)
    trip = get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {**trip, "members": get_trip_members(trip_id)}


@router.post("/{trip_id}/join")
async def join_trip_endpoint(trip_id: int, body: JoinTripRequest, authorization: str = Header(None)):
    wallet = _require_wallet(authorization)
    trip = get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    add_trip_member(trip_id, wallet, body.display_name)
    return {"status": "joined", "trip_id": trip_id}
