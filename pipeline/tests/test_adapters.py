"""Offline adapter tests — every test reads a saved sample, never the network."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.adapters import (
    adithya,
    iitian_vibes,
    nimrah,
    sarthzk,
    simplify,
    speedyapply,
    surya,
    vanshb03,
)
from pipeline.adapters.base import (
    JobRecord,
    dedupe,
    is_india_location,
    job_id,
    normalize_url,
    parse_ts,
)

SAMPLES = Path(__file__).parent / "samples"


@pytest.fixture
def sample(monkeypatch):
    """Patch a module's fetch_json/fetch_raw to read saved sample files."""

    def _load(module, *, json_files=None, raw_files=None):
        json_files = json_files or {}
        raw_files = raw_files or {}

        def fake_json(repo, branch, path):
            return json.loads((SAMPLES / json_files[path]).read_text(encoding="utf-8"))

        def fake_raw(repo, branch, path):
            return (SAMPLES / raw_files[path]).read_text(encoding="utf-8")

        if json_files:
            monkeypatch.setattr(module, "fetch_json", fake_json)
        if raw_files:
            monkeypatch.setattr(module, "fetch_raw", fake_raw)

    return _load


VANSH = {"id": "vanshb03_internships", "repo": "vanshb03/Summer2027-Internships", "branch": "dev"}
IITIAN = {"id": "iitian_vibes", "repo": "iitian-vibes/India-Tech-Internships", "branch": "main",
          "files": ["data/internships.json", "data/closed.json"]}
SIMPLIFY = {"id": "simplify", "repo": "SimplifyJobs/Summer2027-Internships", "branch": "dev"}
SURYA = {"id": "surya", "repo": "SuryaHarikrishnan/2027-internship-tracker", "branch": "master"}
NIMRAH = {"id": "nimrah", "repo": "Nimrah456/india-internships-tracker", "branch": "main"}
ADITHYA = {"id": "adithya", "repo": "adithya012/automated-internship-tracker", "branch": "main"}
SARTHZK = {"id": "sarthzk", "repo": "Sarthzk/internship-tracker", "branch": "main"}
SPEEDY = {"id": "speedyapply", "repos": [
    {"repo": "speedyapply/2027-SWE-College-Jobs", "branch": "main",
     "files": ["INTERN_INTL.md", "NEW_GRAD_INTL.md"]},
]}


def test_iitian_adapter(sample):
    sample(iitian_vibes, json_files={
        "data/internships.json": "iitian_vibes_internships.json",
        "data/closed.json": "iitian_vibes_closed.json",
    })
    records = iitian_vibes.fetch(IITIAN)
    assert records, "expected rows"
    assert all(r.source_id == "iitian_vibes" for r in records)
    assert all(r.apply_url.startswith("https://") for r in records)
    assert any(is_india_location(r.location_raw) for r in records)


def test_iitian_skips_closed(monkeypatch):
    closed = [{"id": "x"}]
    rows = [{"id": "x", "company": "Stripe", "role": "SWE Intern",
             "location": "Bengaluru", "url": "https://example.com/1"},
            {"id": "y", "company": "Acme", "role": "SWE Intern",
             "location": "Bengaluru", "url": "https://example.com/2"}]

    def fake_json(repo, branch, path):
        return closed if path.endswith("closed.json") else rows

    monkeypatch.setattr(iitian_vibes, "fetch_json", fake_json)
    records = iitian_vibes.fetch(IITIAN)
    assert len(records) == 1
    assert records[0].company == "Acme"


def test_simplify_adapter(sample):
    sample(simplify, json_files={".github/scripts/listings.json": "simplify_listings.json"})
    records = simplify.fetch(SIMPLIFY)
    assert records
    assert all(r.location_raw for r in records)
    # inactive rows are excluded
    assert all("inactive" not in r.company.lower() for r in records)


def test_surya_adapter(sample):
    sample(
        surya,
        json_files={"data/listings.json": "surya_listings.json"},
        raw_files={"listings/domestic-india.md": "surya_domestic_india.md"},
    )
    records = surya.fetch(SURYA)
    companies = {r.company for r in records}
    assert "Amazon" in companies and "Adobe" in companies
    # domestic + listings overlap must not produce duplicate URLs
    urls = [r.apply_url for r in records]
    assert len(urls) == len(set(urls))


def test_vanshb03_adapter(sample):
    sample(vanshb03, json_files={".github/scripts/listings.json": "vanshb03_listings.json"})
    records = vanshb03.fetch(VANSH)
    assert len(records) == 6
    assert records[0].source_id == "vanshb03_internships"
    assert all(r.title and r.apply_url for r in records)


def test_vanshb03_skips_hidden(monkeypatch):
    rows = [
        {"company_name": "A", "title": "SWE Intern", "locations": ["Pune"],
         "url": "https://a/1", "active": True, "is_visible": False},
        {"company_name": "B", "title": "SWE Intern", "locations": ["Pune"],
         "url": "https://b/1", "active": False, "is_visible": True},
        {"company_name": "C", "title": "SWE Intern", "locations": ["Pune"],
         "url": "https://c/1", "active": True, "is_visible": True},
    ]
    monkeypatch.setattr(vanshb03, "fetch_json", lambda *a, **k: rows)
    records = vanshb03.fetch(VANSH)
    assert [r.company for r in records] == ["C"]


def test_nimrah_empty_is_valid(sample):
    sample(nimrah, json_files={"data/internships.json": "nimrah_internships.json"})
    assert nimrah.fetch(NIMRAH) == []


def test_adithya_adapter(sample):
    sample(adithya, json_files={"data/internships.json": "adithya_internships.json"})
    records = adithya.fetch(ADITHYA)
    assert len(records) == 1
    assert records[0].company == "Pergolux"


def test_sarthzk_skips_closed(sample):
    sample(sarthzk, json_files={"data/listings.json": "sarthzk_listings.json"})
    records = sarthzk.fetch(SARTHZK)
    assert records
    assert all(r.company != "Apple" or "closed" not in r.location_raw for r in records)


def test_speedyapply_adapter(sample):
    sample(speedyapply, raw_files={
        "INTERN_INTL.md": "speedyapply_2027-SWE-College-Jobs_INTERN_INTL.md",
        "NEW_GRAD_INTL.md": "speedyapply_2027-SWE-College-Jobs_NEW_GRAD_INTL.md",
    })
    records = speedyapply.fetch(SPEEDY)
    assert records
    assert all(r.company and r.apply_url.startswith("https://") for r in records)


def test_normalize_url_strips_only_tracking():
    url = "https://jobs.lever.co/acme/123?utm_source=x&gh_jid=99&ref=abc&source=li&keep=1"
    assert normalize_url(url) == "https://jobs.lever.co/acme/123?gh_jid=99&keep=1"


def test_job_id_stable_and_distinct():
    a = JobRecord(source_id="a", company="X", title="SWE Intern", location_raw="Pune",
                  apply_url="https://x.com/j?utm_source=1&gh_jid=7")
    b = a.model_copy(update={"apply_url": "https://x.com/j?gh_jid=7", "source_id": "b"})
    assert job_id(a) == job_id(b) != ""
    c = b.model_copy(update={"apply_url": "https://x.com/j?gh_jid=8"})
    assert job_id(c) != job_id(a)


def test_dedupe_records_all_sources():
    recs = [
        JobRecord(source_id="a", company="X", title="SWE", location_raw="Pune",
                  apply_url="https://x.com/j?utm_medium=1"),
        JobRecord(source_id="b", company="X", title="SWE", location_raw="Pune",
                  apply_url="https://x.com/j"),
    ]
    unique, sources = dedupe(recs)
    assert len(unique) == 1
    assert set(sources[job_id(unique[0])]) == {"a", "b"}


@pytest.mark.parametrize("location,expected", [
    ("Bengaluru", True), ("Bangalore, India", True), ("Remote in India", True),
    ("New York, NY", False), ("London, UK", False), ("Remote", False), ("", False),
])
def test_india_filter(location, expected):
    assert is_india_location(location) is expected


def test_parse_ts_formats():
    assert parse_ts(1774261894).year == 2026
    assert parse_ts("2026-10-28").month == 10
    assert parse_ts("") is None
