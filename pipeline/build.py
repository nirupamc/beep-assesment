"""Fetch -> filter -> dedupe -> tag -> lifecycle -> write.

Guarantees:
  * A failing source never wipes its listings; they keep their previous
    last_seen and an issue is opened.
  * A sudden collapse in row count aborts the write and keeps the old
    jobs.json, opening an issue instead.
  * jobs.json is never written empty.

Run:  python pipeline/build.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import requests  # noqa: E402

from pipeline.adapters import ADAPTERS  # noqa: E402
from pipeline.adapters.base import dedupe, is_india_location, job_id  # noqa: E402
from pipeline.config import (  # noqa: E402
    DATA_DIR,
    JOBS_OUT,
    SOURCES_OUT,
    enabled_sources,
)
from pipeline.tagger import tag_records  # noqa: E402

STATE_FILE = DATA_DIR / "state.json"
RETENTION_DAYS = 14
DROP_RATIO = 0.5
MIN_ROWS_FOR_RATIO_GUARD = 20

TAG_FIELDS = ("role_category", "city", "experience_type")


# --- helpers -----------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat().replace("+00:00", "Z") if dt else None


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def open_issue(title: str, body: str) -> None:
    """Open a GitHub issue when running in Actions; print locally."""
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        print(f"[issue skipped: no GITHUB_TOKEN/GITHUB_REPOSITORY] {title}")
        return
    try:
        response = requests.post(
            f"https://api.github.com/repos/{repo}/issues",
            headers={"Authorization": f"Bearer {token}",
                     "Accept": "application/vnd.github+json"},
            json={"title": title, "body": body},
            timeout=30,
        )
        response.raise_for_status()
        print(f"[issue opened] {title}")
    except Exception as exc:  # reporting must never fail the run
        print(f"[issue failed] {type(exc).__name__}: {exc}")


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"jobs": {}}


def save_state(state: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(state, indent=1, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )


def fetch_all(sources: list[dict]) -> tuple[list, list[str], list[str]]:
    from pipeline.adapters.base import AdapterError

    records, failures, failed_ids = [], [], []
    for src in sources:
        adapter = ADAPTERS.get(src["adapter"])
        if adapter is None:
            failures.append(f"`{src['id']}`: no adapter named `{src['adapter']}`")
            failed_ids.append(src["id"])
            continue
        try:
            got = adapter(src)
        except AdapterError as exc:
            failures.append(f"`{src['id']}`: {exc}")
            failed_ids.append(src["id"])
            continue
        except Exception as exc:
            failures.append(f"`{src['id']}`: {type(exc).__name__}: {exc}")
            failed_ids.append(src["id"])
            continue
        print(f"  {src['id']:<24} {len(got):>6} rows")
        records.extend(got)
    return records, failures, failed_ids


def too_large_drop(previous_live: int, current: int) -> bool:
    return (previous_live >= MIN_ROWS_FOR_RATIO_GUARD
            and current < previous_live * DROP_RATIO)


def merge_jobs(
    previous: dict,
    accepted: list,
    tags: list[dict],
    sources_by_job: dict[str, list[str]],
    failed_ids: list[str],
    now: datetime,
) -> tuple[dict, int]:
    """Apply seen/closed lifecycle. Returns (jobs, aged_out_count)."""
    seen_ids: set[str] = set()
    for rec, tag in zip(accepted, tags):
        jid = job_id(rec)
        seen_ids.add(jid)
        old = previous.get(jid, {})
        previous[jid] = {
            "id": jid,
            "company": rec.company.strip(),
            "title": rec.title.strip(),
            "location_raw": " ".join(rec.location_raw.split()),
            "apply_url": rec.apply_url,
            "posted_at": _iso(rec.posted_at) or old.get("posted_at"),
            "first_seen": old.get("first_seen") or _iso(now),
            "last_seen": _iso(now),
            "sources": sorted(set(sources_by_job.get(jid, [])) | set(old.get("sources", []))),
            "closed_at": None,
            **{k: tag[k] for k in TAG_FIELDS},
        }

    # A failed source cannot confirm a job is gone, so its jobs stay open.
    for jid, job in previous.items():
        if jid in seen_ids:
            continue
        if job.get("closed_at") is None:
            job["closed_at"] = _iso(now)
        if set(job.get("sources", [])) & set(failed_ids):
            job["closed_at"] = None

    cutoff = now - timedelta(days=RETENTION_DAYS)
    aged_out = 0
    for jid in list(previous):
        closed = _parse_iso(previous[jid].get("closed_at"))
        if closed and closed < cutoff:
            del previous[jid]
            aged_out += 1
    return previous, aged_out


def build_sources_json(sources: list[dict], refreshed: datetime) -> dict:
    return {
        "last_refreshed": _iso(refreshed),
        "sources": [
            {
                "id": s["id"],
                "name": s.get("name") or s["id"],
                "repo": s.get("repo") or ", ".join(
                    r["repo"] for r in s.get("repos", [])),
                "url": s.get("repo_url") or "https://github.com/" + (
                    s.get("repo") or s.get("repos", [{}])[0].get("repo", "")),
                "license": s.get("license", ""),
                "license_url": s.get("license_url", ""),
                "attribution": s.get("attribution", ""),
                "notes": " ".join(str(s.get("notes", "")).split()),
            }
            for s in sources
        ],
    }


# --- main --------------------------------------------------------------


def run() -> int:
    started = _now()
    sources = enabled_sources()
    print(f"Fetching {len(sources)} enabled sources")

    records, failures, failed_ids = fetch_all(sources)
    india = [r for r in records if is_india_location(r.location_raw)]
    unique, sources_by_job = dedupe(india)
    accepted = [r for r in unique if r.apply_url]
    print(f"India rows: {len(india)}  unique: {len(unique)}  with apply URL: {len(accepted)}")

    if not accepted:
        open_issue(
            "Refresh aborted: no usable India listings",
            "Every source returned zero usable India rows. The previous "
            "`web/public/jobs.json` was left untouched.\n\nFailures:\n"
            + ("\n".join(f"- {f}" for f in failures) or "- none"),
        )
        print("ABORT: nothing to publish; previous jobs.json left in place.")
        return 1

    state = load_state()
    previous = state.get("jobs", {})
    previous_live = sum(
        1 for job in previous.values() if not job.get("closed_at")
    )

    if too_large_drop(previous_live, len(accepted)):
        message = (
            f"Refresh aborted: live listings dropped from {previous_live} to "
            f"{len(accepted)} (<{int(DROP_RATIO * 100)}%).\n\n"
            "`web/public/jobs.json` was left untouched. Failures:\n"
            + ("\n".join(f"- {f}" for f in failures) or "- none")
        )
        open_issue("Refresh aborted: large drop in live listings", message)
        print("ABORT: large drop; previous jobs.json left in place.")
        return 1

    tags, llm_calls = tag_records(accepted)
    print(f"LLM calls this run: {llm_calls}")

    now = _now()
    previous, dropped = merge_jobs(
        previous, accepted, tags, sources_by_job, failed_ids, now
    )
    live = [job for job in previous.values() if not job.get("closed_at")]
    live.sort(
        key=lambda j: (j.get("posted_at") or j.get("first_seen") or ""),
        reverse=True,
    )

    if not live:
        open_issue(
            "Refresh aborted: lifecycle produced no live listings",
            "All known jobs closed at once, which is far more likely a source "
            "problem than a real market change. `jobs.json` was left untouched.",
        )
        print("ABORT: no live listings after lifecycle; nothing written.")
        return 1

    state["jobs"] = previous
    state["last_refreshed"] = _iso(now)
    save_state(state)

    JOBS_OUT.parent.mkdir(parents=True, exist_ok=True)
    # jobs.json is a plain array, as required; last_refreshed lives in
    # sources.json so the banner has a single source of truth.
    JOBS_OUT.write_text(
        json.dumps(live, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    SOURCES_OUT.write_text(
        json.dumps(build_sources_json(sources, now), indent=1, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Wrote {len(live)} live jobs, {len(previous) - len(live)} closed, "
          f"{dropped} aged out.")
    if failures:
        open_issue(
            "Source fetch failures during refresh",
            "Some sources failed; their stored listings were kept.\n\n"
            + "\n".join(f"- {f}" for f in failures),
        )
        print("Source failures:\n  " + "\n  ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run())
