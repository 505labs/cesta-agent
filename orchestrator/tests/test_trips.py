"""Tests for trip management endpoints."""

import pytest
from fastapi.testclient import TestClient

from main import app
from auth import create_session
from db import init_db

client = TestClient(app)


def auth_header(wallet: str = "0xAlice") -> dict:
    token = create_session(wallet)
    return {"Authorization": f"Bearer {token}"}


class TestTrips:
    def test_create_trip(self):
        resp = client.post("/v1/trips", json={"name": "Cannes Road Trip"}, headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Cannes Road Trip"
        assert data["organizer_wallet"] == "0xalice"

    def test_list_trips(self):
        headers = auth_header("0xBob")
        client.post("/v1/trips", json={"name": "Trip 1"}, headers=headers)
        client.post("/v1/trips", json={"name": "Trip 2"}, headers=headers)

        resp = client.get("/v1/trips", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_get_trip_with_members(self):
        headers = auth_header("0xCarol")
        resp = client.post("/v1/trips", json={"name": "Test Trip"}, headers=headers)
        trip_id = resp.json()["id"]

        resp = client.get(f"/v1/trips/{trip_id}", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()["members"]) == 1

    def test_join_trip(self):
        headers_org = auth_header("0xOrg")
        resp = client.post("/v1/trips", json={"name": "Join Test"}, headers=headers_org)
        trip_id = resp.json()["id"]

        headers_joiner = auth_header("0xJoiner")
        resp = client.post(f"/v1/trips/{trip_id}/join", json={}, headers=headers_joiner)
        assert resp.status_code == 200

        resp = client.get(f"/v1/trips/{trip_id}", headers=headers_org)
        assert len(resp.json()["members"]) == 2

    def test_unauthorized(self):
        resp = client.post("/v1/trips", json={"name": "No Auth"})
        assert resp.status_code == 401

    def test_trip_not_found(self):
        resp = client.get("/v1/trips/99999", headers=auth_header())
        assert resp.status_code == 404


class TestHealth:
    def test_health_endpoint(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "roadtrip-orchestrator"

    def test_nonce_endpoint(self):
        resp = client.get("/v1/auth/nonce")
        assert resp.status_code == 200
        assert "nonce" in resp.json()
        assert len(resp.json()["nonce"]) == 32
