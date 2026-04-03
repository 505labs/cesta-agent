"""Tests for SIWE wallet authentication."""

import pytest
from auth import generate_nonce, create_session, get_session, get_wallet_from_request, _nonces, _sessions


class TestNonce:
    def test_generate_nonce_unique(self):
        n1 = generate_nonce()
        n2 = generate_nonce()
        assert n1 != n2
        assert len(n1) == 32  # 16 bytes hex

    def test_generate_nonce_stored(self):
        nonce = generate_nonce()
        assert nonce in _nonces


class TestSession:
    def test_create_and_get_session(self):
        token = create_session("0xAbC123")
        session = get_session(token)
        assert session is not None
        assert session["wallet_address"] == "0xabc123"  # lowercased

    def test_invalid_token(self):
        assert get_session("nonexistent") is None

    def test_get_wallet_from_request(self):
        token = create_session("0xDEF456")
        wallet = get_wallet_from_request(f"Bearer {token}")
        assert wallet == "0xdef456"

    def test_get_wallet_no_header(self):
        assert get_wallet_from_request(None) is None

    def test_get_wallet_bad_header(self):
        assert get_wallet_from_request("Basic abc") is None
