"""speedyapply — speedyapply/2027-SWE-College-Jobs and 2027-AI-College-Jobs
(DISABLED — no license file).

Verified files in both repos: INTERN_INTL.md and NEW_GRAD_INTL.md. They are
Markdown tables shaped like:

    | <a href="https://co"><strong>Company</strong></a> | Role | Location | <a href="apply"><img .../></a> | 5d |

Only international/India rows are useful; the downstream India filter keeps
them. The source is configured with a `repos` list instead of `repo`.
"""
from __future__ import annotations

import re

from .base import JobRecord, fetch_raw, is_separator_row

TAG_RE = re.compile(r"<[^>]+>")
HREF_RE = re.compile(r'href="(https?://[^"]+)"')
MDLINK_RE = re.compile(r"\[[^\]]*\]\((https?://[^)]+)\)")


def _parse_table(md: str, source_id: str) -> list[JobRecord]:
    out: list[JobRecord] = []
    for line in md.splitlines():
        line = line.strip()
        if not line.startswith("|") or is_separator_row(line):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 4 or cells[0].lower().strip("<> ") in {"company", "position"}:
            continue
        company = TAG_RE.sub("", cells[0]).strip()
        title, location, link_cell = cells[1], cells[2], cells[3]
        match = HREF_RE.search(link_cell) or MDLINK_RE.search(link_cell)
        if not company or not match:
            continue
        out.append(
            JobRecord(
                source_id=source_id,
                company=company,
                title=TAG_RE.sub("", title).strip(),
                location_raw=TAG_RE.sub("", location).strip(),
                apply_url=match.group(1),
                posted_at=None,
                raw_id=None,
            )
        )
    return out


def fetch(source: dict) -> list[JobRecord]:
    out: list[JobRecord] = []
    for entry in source.get("repos", []):
        for path in entry.get("files", []):
            out.extend(
                _parse_table(
                    fetch_raw(entry["repo"], entry["branch"], path), source["id"]
                )
            )
    return out
