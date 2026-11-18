"""Surya — SuryaHarikrishnan/2027-internship-tracker @ master.

Verified files:
  * listings/domestic-india.md — India-only Markdown tables, `### Company`
    headings then `| Role | Location | Link |` rows.
  * data/listings.json — JSON array of international rows with `company_name`,
    `title`, `locations` (list), `url`, `date_posted` (epoch), `active`.

The two overlap, so the adapter de-duplicates by URL before returning.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse

from .base import AdapterError, JobRecord, fetch_json, fetch_raw, is_separator_row, parse_ts

LINK_RE = re.compile(r"\[([^\]]*)\]\((https?://[^)]+)\)")
TAG_RE = re.compile(r"<[^>]+>")


def _parse_domestic(md: str, source_id: str) -> list[JobRecord]:
    out: list[JobRecord] = []
    company = ""
    for line in md.splitlines():
        line = line.strip()
        if line.startswith("### "):
            company = line[4:].strip()
            continue
        if not line.startswith("|") or is_separator_row(line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3 or cells[0].lower() in {"role", "position", "company"}:
            continue
        role, location, link_cell = cells[0], cells[1], cells[2]
        match = LINK_RE.search(link_cell)
        if not match or not company:
            continue
        out.append(
            JobRecord(
                source_id=source_id,
                company=TAG_RE.sub("", company),
                title=role,
                location_raw=location,
                apply_url=match.group(2),
                posted_at=None,
                raw_id=None,
            )
        )
    return out


def _parse_listings(rows: list, source_id: str) -> list[JobRecord]:
    out: list[JobRecord] = []
    for row in rows:
        if row.get("active") is False:
            continue
        locations = row.get("locations") or []
        if isinstance(locations, str):
            locations = [locations]
        try:
            out.append(
                JobRecord(
                    source_id=source_id,
                    company=row.get("company_name") or "",
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
    domestic = _parse_domestic(
        fetch_raw(repo, branch, "listings/domestic-india.md"), source["id"]
    )
    rows = fetch_json(repo, branch, "data/listings.json")
    if not isinstance(rows, list):
        raise AdapterError(f"{repo}: data/listings.json must be a JSON array")
    international = _parse_listings(rows, source["id"])

    seen: set[str] = set()
    merged: list[JobRecord] = []
    for rec in domestic + international:
        key = f"{urlparse(rec.apply_url).netloc.lower()}{urlparse(rec.apply_url).path.rstrip('/')}"
        if key in seen:
            continue
        seen.add(key)
        merged.append(rec)
    return merged
