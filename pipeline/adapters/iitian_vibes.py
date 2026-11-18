"""IITian Vibes — iitian-vibes/India-Tech-Internships.

Verified files: data/internships.json (array) and data/closed.json (array of
retired postings). Rows carry `company`, `role`, `location`, `url`, `posted`,
`id`. The file includes non-India rows; filtering happens downstream, but rows
the maintainer has already closed are dropped here so they are never revived.
"""
from __future__ import annotations

from .base import AdapterError, JobRecord, fetch_json, parse_ts


def fetch(source: dict) -> list[JobRecord]:
    repo, branch = source["repo"], source["branch"]
    rows = fetch_json(repo, branch, "data/internships.json")
    if not isinstance(rows, list):
        raise AdapterError(f"{repo}: data/internships.json must be a JSON array")

    closed_ids: set[str] = set()
    if "data/closed.json" in source.get("files", []):
        closed = fetch_json(repo, branch, "data/closed.json")
        if not isinstance(closed, list):
            raise AdapterError(f"{repo}: data/closed.json must be a JSON array")
        closed_ids = {str(r.get("id")) for r in closed if r.get("id")}

    out: list[JobRecord] = []
    for row in rows:
        try:
            raw_id = str(row.get("id") or "") or None
            if raw_id and raw_id in closed_ids:
                continue
            out.append(
                JobRecord(
                    source_id=source["id"],
                    company=row.get("company", ""),
                    title=row.get("role") or row.get("title", ""),
                    location_raw=row.get("location", ""),
                    apply_url=row.get("url", ""),
                    posted_at=parse_ts(row.get("posted")),
                    raw_id=raw_id,
                )
            )
        except ValueError:
            continue
    return out
