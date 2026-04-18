#!/usr/bin/env bash
set -e
python scripts/ingest.py
exec uvicorn src.api.main:app --host 0.0.0.0 --port 8000
