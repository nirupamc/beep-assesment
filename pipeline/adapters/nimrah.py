"""Nimrah — Nimrah456/india-internships-tracker @ main.

Verified file: data/internships.json, a JSON object:
    {generated_at, count, internships: [...], errors: [...]}
Each row carries `company`, `category`, `title`, `location`, `url`,
`first_seen` (field names confirmed in scripts/scraper.py, not guessed).

The upstream scraper frequently gets 404s from the boards it reads, so
`count: 0` with a populated `errors` list is a valid, non-fatal response.
"""
from __future__ import annotations

from .base import AdapterError, JobRecord, fetch_json, parse_ts


def fetch(source: dict) -> list[JobRecord]:
    repo, branch = source["repo"], source["branch"]
    data = fetch_json(repo, branch, "data/internships.json")
    if not isinstance(data, dict) or "internships" not in data:
        raise AdapterError(
            f"{repo}: data/internships.json must be an object with an "
            f"'internships' array"
        )
    rows = data.get("internships") or []
    out: list[JobRecord] = []
    for row in rows:
        try:
            out.append(
                JobRecord(
                    source_id=source["id"],
                    company=row.get("company", ""),
                    title=row.get("title", ""),
                    location_raw=row.get("location", ""),
                    apply_url=row.get("url", ""),
                    posted_at=parse_ts(row.get("first_seen")),
                    raw_id=None,
                )
            )
        except ValueError:
            continue
    return out
