"""Shared test configuration."""

import os
import sys
import tempfile

# Ensure orchestrator package is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Use a temporary database for tests
_tmpdir = tempfile.mkdtemp()
os.environ["DB_PATH"] = os.path.join(_tmpdir, "test.db")

# Initialize the database before tests run
from db import init_db
init_db()
