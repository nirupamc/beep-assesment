"""Sarthzk — Sarthzk/internship-tracker @ main (DISABLED, ALL RIGHTS RESERVED).

Verified file: data/listings.json, a JSON array with `company`, `title`,
`locations` (list), `url`, `date_posted` (YYYY-MM-DD), `status` ("closed" when
the source retired it), `id`, `first_seen`.

The adapter is complete and tested, but the repository is all rights reserved.
Do not enable it until the maintainer gives written permission.
"""
from __future__ import annotations

from .base import AdapterError, JobRecord, fetch_json, parse_ts


def fetch(source: dict) -> list[JobRecord]:
    repo, branch = source["repo"], source["branch"]
    rows = fetch_json(repo, branch, "data/listings.json")
    if not isinstance(rows, list):
        raise AdapterError(f"{repo}: data/listings.json must be a JSON array")
    out: list[JobRecord] = []
    for row in rows:
        if str(row.get("status", "")).lower() == "closed":
            continue
        locations = row.get("locations") or []
        if isinstance(locations, str):
            locations = [locations]
        try:
            out.append(
                JobRecord(
                    source_id=source["id"],
                    company=row.get("company", ""),
                    title=row.get("title", ""),
                    location_raw="; ".join(str(l) for l in locations),
                    apply_url=row.get("url", ""),
                    posted_at=parse_ts(row.get("date_posted")),
                    raw_id=str(row.get("id") or "") or None,
                )
            )
        except ValueError:
            continue
    return out
