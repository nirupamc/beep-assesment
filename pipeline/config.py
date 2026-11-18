"""Loads pipeline/sources.yml — the single source of truth for sources."""
from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = ROOT / "pipeline"
SOURCES_FILE = PIPELINE_DIR / "sources.yml"
DATA_DIR = PIPELINE_DIR / "data"
JOBS_OUT = ROOT / "web" / "public" / "jobs.json"
SOURCES_OUT = ROOT / "web" / "public" / "sources.json"


def load_config() -> dict:
    with SOURCES_FILE.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def all_sources() -> list[dict]:
    return load_config()["sources"]


def enabled_sources() -> list[dict]:
    return [s for s in all_sources() if s.get("enabled")]


def india_config() -> dict:
    return load_config().get("india", {})
