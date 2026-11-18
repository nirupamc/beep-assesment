"""adithya012 — adithya012/automated-internship-tracker @ main (DISABLED).

Verified file: data/internships.json, an object:
    {last_updated_utc, jobs: [...]}
Rows carry `id`, `title`, `company`, `location`, `url`, `posted_at`.
Built and tested; stays disabled until the data license is reviewed.
"""
from __future__ import annotations

from .base import AdapterError, JobRecord, fetch_json, parse_ts


def fetch(source: dict) -> list[JobRecord]:
    repo, branch = source["repo"], source["branch"]
    data = fetch_json(repo, branch, "data/internships.json")
    if not isinstance(data, dict) or "jobs" not in data:
        raise AdapterError(f"{repo}: data/internships.json must have a 'jobs' array")
    out: list[JobRecord] = []
    for row in data.get("jobs") or []:
        try:
            out.append(
                JobRecord(
                    source_id=source["id"],
                    company=row.get("company", ""),
                    title=row.get("title", ""),
                    location_raw=row.get("location", ""),
                    apply_url=row.get("url", ""),
                    posted_at=parse_ts(row.get("posted_at")),
                    raw_id=str(row.get("id") or "") or None,
                )
            )
        except ValueError:
            continue
    return out
