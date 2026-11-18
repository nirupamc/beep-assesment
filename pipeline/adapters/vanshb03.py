"""vansh — vanshb03/Summer2027-Internships and vanshb03/New-Grad-2027 @ dev.

Both are MIT-licensed (verified via the GitHub API) and publish
`.github/scripts/listings.json` with the same schema as SimplifyJobs, whose
feed is derived from them. One adapter serves both entries; the source id
distinguishes them so the Sources page can credit each repo.

At the time of writing neither repo has India-located rows. That is valid empty
output, not a failure — the India filter is applied downstream.
"""
from __future__ import annotations

from .base import AdapterError, JobRecord, fetch_json
from .simplify import parse_rows


def fetch(source: dict) -> list[JobRecord]:
    repo, branch = source["repo"], source["branch"]
    rows = fetch_json(repo, branch, ".github/scripts/listings.json")
    if not isinstance(rows, list):
        raise AdapterError(f"{repo}: listings.json must be a JSON array")
    return parse_rows(rows, source["id"])
