"""SimplifyJobs — SimplifyJobs/Summer2027-Internships @ dev.

Verified file: .github/scripts/listings.json (JSON array, ~17k rows). Rows carry
`company_name`, `title`, `locations` (list), `url`, `date_posted` (epoch
seconds), `active`, `is_visible`, `id`. Almost all rows are US; the India filter
downstream keeps the few that are not.

`parse_rows` is shared with the vanshb03 adapters, which publish the same
schema (Simplify's feed is derived from them).
"""
from __future__ import annotations

from .base import AdapterError, JobRecord, fetch_json, parse_ts


def parse_rows(rows: list, source_id: str) -> list[JobRecord]:
    out: list[JobRecord] = []
    for row in rows:
        if row.get("active") is False or row.get("is_visible") is False:
            continue
        locations = row.get("locations") or []
        if isinstance(locations, str):
            locations = [locations]
        try:
            out.append(
                JobRecord(
                    source_id=source_id,
                    company=row.get("company_name") or row.get("company", ""),
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


def fetch(source: dict) -> list[JobRecord]:
    repo, branch = source["repo"], source["branch"]
    rows = fetch_json(repo, branch, ".github/scripts/listings.json")
    if not isinstance(rows, list):
        raise AdapterError(f"{repo}: listings.json must be a JSON array")
    return parse_rows(rows, source["id"])
