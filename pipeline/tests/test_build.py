"""Lifecycle and safety-guard tests for build.py (no network)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from pipeline.adapters.base import JobRecord, job_id
from pipeline.build import (
    build_sources_json,
    merge_jobs,
    too_large_drop,
)

NOW = datetime(2026, 11, 18, 2, 0, tzinfo=timezone.utc)
TAGS = {"role_category": "Software Engineering", "city": "Bengaluru",
        "experience_type": "Internship"}


def rec(title="SWE Intern", url="https://example.com/1"):
    return JobRecord(source_id="simplify", company="Acme", title=title,
                     location_raw="Bengaluru, India", apply_url=url)


def old_job(**over):
    job = {
        "id": "old", "company": "Old Co", "title": "SWE Intern",
        "location_raw": "Pune", "apply_url": "https://example.com/old",
        "posted_at": None, "first_seen": "2026-11-01T00:00:00Z",
        "last_seen": "2026-11-17T00:00:00Z", "sources": ["simplify"],
        "closed_at": None, **TAGS,
    }
    job.update(over)
    return job


def test_merge_records_sources_and_keeps_first_seen():
    r = rec()
    previous = {job_id(r): old_job(id=job_id(r), advertised="x")}
    jobs, _ = merge_jobs(previous, [r], [TAGS], {job_id(r): ["simplify", "surya"]},
                         [], NOW)
    job = jobs[job_id(r)]
    assert job["sources"] == ["simplify", "surya"]
    assert job["first_seen"] == "2026-11-01T00:00:00Z"
    assert job["last_seen"].startswith("2026-11-18")


def test_unseen_job_is_closed_not_deleted():
    previous = {"old": old_job()}
    jobs, aged = merge_jobs(previous, [], [], {}, [], NOW)
    assert jobs["old"]["closed_at"].startswith("2026-11-18")
    assert aged == 0


def test_job_from_failed_source_stays_open():
    previous = {"old": old_job()}
    jobs, _ = merge_jobs(previous, [], [], {}, ["simplify"], NOW)
    assert jobs["old"]["closed_at"] is None


def test_job_closed_longer_than_retention_is_dropped():
    old = old_job(closed_at=(NOW - timedelta(days=20)).isoformat())
    jobs, aged = merge_jobs({"old": old}, [], [], {}, [], NOW)
    assert "old" not in jobs and aged == 1


def test_ratio_guard():
    assert too_large_drop(272, 50) is True       # 18% of previous
    assert too_large_drop(272, 200) is False
    assert too_large_drop(10, 1) is False        # too few to judge


def test_sources_json_exposes_license_and_attribution():
    sources = [{
        "id": "simplify", "name": "SimplifyJobs", "repo": "SimplifyJobs/X",
        "license": "MIT", "license_url": "https://l", "attribution": "SimplifyJobs",
        "notes": "line one\n      line two",
    }]
    out = build_sources_json(sources, NOW)
    assert out["sources"][0]["license"] == "MIT"
    assert out["sources"][0]["attribution"] == "SimplifyJobs"
    assert out["sources"][0]["notes"] == "line one line two"
    assert out["sources"][0]["url"] == "https://github.com/SimplifyJobs/X"
    assert out["last_refreshed"].startswith("2026-11-18")
