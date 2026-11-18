"""Shared adapter contract and helpers.

Every adapter returns a list of ``JobRecord``. Nothing else in the pipeline
knows what a source's JSON looks like.
"""
from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Iterable

import requests
from pydantic import BaseModel, field_validator

USER_AGENT = "india-fresher-tech-radar/1.0 (+https://github.com/)"
TIMEOUT = 60

# Tracking parameters we drop when computing a job id. Anything not listed here
# is preserved, which is why ids like `gh_jid` survive.
TRACKING_PARAMS = {"ref", "source", "gh_src"}
TRACKING_PREFIXES = ("utm_",)

INDIA_CITY_RE = re.compile(
    r"\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|new delhi|"
    r"gurugram|gurgaon|noida|chennai|kolkata|ahmedabad)\b",
    re.IGNORECASE,
)
REMOTE_INDIA_RE = re.compile(
    r"\bremote\s*(?:-|–|,)?\s*(?:in\s+)?india\b|\bremote\s+india\b", re.IGNORECASE
)


class AdapterError(RuntimeError):
    """Raised when a source's expected file is missing or unparseable."""


class JobRecord(BaseModel):
    source_id: str
    company: str
    title: str
    location_raw: str
    apply_url: str
    posted_at: datetime | None = None
    raw_id: str | None = None

    @field_validator("company", "title", "location_raw", "apply_url", mode="before")
    @classmethod
    def _clean(cls, v: Any) -> str:
        if v is None:
            return ""
        return re.sub(r"\s+", " ", str(v)).strip()

    @field_validator("apply_url")
    @classmethod
    def _http(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError(f"apply_url must be absolute http(s), got {v!r}")
        return v


def fetch_raw(repo: str, branch: str, path: str) -> str:
    """Fetch a file from raw.githubusercontent.com. Raises AdapterError clearly."""
    url = f"https://raw.githubusercontent.com/{repo}/{branch}/{path}"
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    except requests.RequestException as exc:  # network problem
        raise AdapterError(f"{repo}: network error fetching {path}: {exc}") from exc
    if r.status_code != 200:
        raise AdapterError(
            f"{repo}: expected file {path} on branch {branch} "
            f"returned HTTP {r.status_code}"
        )
    return r.text


def fetch_json(repo: str, branch: str, path: str) -> Any:
    text = fetch_raw(repo, branch, path)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise AdapterError(f"{repo}: {path} is not valid JSON: {exc}") from exc


def list_tree(repo: str, branch: str) -> list[str]:
    """List blob paths so a missing file is diagnosed, not guessed around."""
    url = f"https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1"
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    except requests.RequestException as exc:
        raise AdapterError(f"{repo}: network error listing tree: {exc}") from exc
    if r.status_code != 200:
        raise AdapterError(f"{repo}: tree listing for {branch} returned HTTP {r.status_code}")
    return [t["path"] for t in r.json().get("tree", []) if t.get("type") == "blob"]


SEPARATOR_ROW_RE = re.compile(r"^\|[\s:|-]+\|$")


def is_separator_row(line: str) -> bool:
    """True for a Markdown table divider (| --- | :--: |), not for content
    that merely contains hyphens inside a URL."""
    return bool(SEPARATOR_ROW_RE.match(line.strip()))


def parse_ts(value: Any) -> datetime | None:
    """Best-effort timestamp parse: epoch seconds, ISO 8601, or date."""
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return parse_ts(int(text))
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_india_location(location: str | None) -> bool:
    """True if a location string names India or an Indian city."""
    if not location:
        return False
    return bool(INDIA_CITY_RE.search(location)) or bool(REMOTE_INDIA_RE.search(location))


def normalize_url(url: str) -> str:
    """Strip only tracking params, preserving values like gh_jid."""
    parts = urllib.parse.urlsplit(url.strip())
    kept: list[tuple[str, str]] = []
    for key, value in urllib.parse.parse_qsl(parts.query, keep_blank_values=True):
        low = key.lower()
        if low in TRACKING_PARAMS or low.startswith(TRACKING_PREFIXES):
            continue
        kept.append((key, value))
    query = urllib.parse.urlencode(kept)
    path = parts.path.rstrip("/") or "/"
    netloc = parts.netloc.lower()
    normalized = urllib.parse.urlunsplit((parts.scheme.lower(), netloc, path, query, ""))
    return normalized


def _norm_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def job_id(record: JobRecord, city: str | None = None) -> str:
    """SHA-256 of the normalized URL; fallback to company+title+city."""
    if record.apply_url:
        key = normalize_url(record.apply_url)
    else:
        key = f"{_norm_text(record.company)}|{_norm_text(record.title)}|{_norm_text(city or record.location_raw)}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def dedupe(records: Iterable[JobRecord]) -> tuple[list[JobRecord], dict[str, list[str]]]:
    """Collapse records by normalized URL, remembering every source that listed it."""
    seen: dict[str, JobRecord] = {}
    sources: dict[str, list[str]] = {}
    for rec in records:
        if not rec.apply_url:
            continue
        jid = job_id(rec)
        sources.setdefault(jid, [])
        if rec.source_id not in sources[jid]:
            sources[jid].append(rec.source_id)
        # Prefer a record that has a posted_at date.
        if jid not in seen or (seen[jid].posted_at is None and rec.posted_at is not None):
            seen[jid] = rec
    return list(seen.values()), sources
