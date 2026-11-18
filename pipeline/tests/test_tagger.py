"""Tagger tests: rules first, enum-validated LLM only for leftovers, caching."""
from __future__ import annotations

import json

import pytest

from pipeline.adapters.base import JobRecord
from pipeline.tagger import (
    CITIES,
    ROLE_CATEGORIES,
    cache_key,
    load_cache,
    role_from_rules,
    city_from_rules,
    tag_records,
)


def rec(title, location="Bengaluru, India", url="https://example.com/job"):
    return JobRecord(source_id="t", company="Acme", title=title,
                     location_raw=location, apply_url=url)


@pytest.mark.parametrize("title,city,role", [
    ("Software Engineer Intern", "Bengaluru, India", "Software Engineering"),
    ("Machine Learning Intern", "Hyderabad", "AI / ML"),
    ("Data Analyst Intern", "Pune", "Data Science & Analytics"),
    ("Frontend Developer Intern", "Remote India", "Frontend"),
    ("Backend Engineer Intern", "Chennai", "Backend"),
    ("DevOps Intern", "Gurugram", "DevOps / Cloud"),
    ("Embedded Systems Intern", "Noida", "Hardware / Embedded"),
    ("Product Design Intern", "Mumbai", "Product / Design"),
])
def test_rules_classify(title, city, role):
    assert role_from_rules(title) == role
    assert city_from_rules(city) is not None


def test_unresolved_role_is_none_so_the_llm_decides():
    assert role_from_rules("Campus Ambassador") is None


def test_multiple_cities_become_pan_india():
    assert city_from_rules("Bengaluru; Hyderabad; Pune") == "Multiple / Pan-India"


def test_remote_india_is_recognised():
    assert city_from_rules("Remote - India") == "Remote (India)"


def test_rules_only_makes_no_llm_calls_and_no_cache_miss(tmp_path):
    calls = []
    tags, n = tag_records(
        [rec("Software Engineer Intern"), rec("Data Analyst Intern", "Pune")],
        complete=lambda p: calls.append(p) or "",
        cache_path=tmp_path / "cache.json",
    )
    assert n == 0 and calls == []
    assert tags[0]["role_category"] == "Software Engineering"
    assert tags[0]["experience_type"] == "Internship"


def test_llm_only_for_unresolved_in_batches(tmp_path):
    seen_batches = []

    def complete(prompt):
        payload = json.loads(prompt.split("Listings:\n", 1)[1])
        seen_batches.append(len(payload))
        return json.dumps({"results": [
            {"index": i, "role_category": "Other", "city": "Pune"}
            for i in range(len(payload))
        ]})

    jobs = [rec("Associate", "Pune") for _ in range(40)]
    tags, n = tag_records(jobs, complete=complete, cache_path=tmp_path / "c.json")
    assert n == 3 and seen_batches == [18, 18, 4]
    assert all(t["city"] == "Pune" for t in tags)


def test_invalid_llm_output_falls_back_and_retries(tmp_path):
    calls = []

    def complete(prompt):
        calls.append(prompt)
        return '{"results":[{"index":0,"role_category":"Wizard","city":"Mars"}]}'

    tags, n = tag_records([rec("Associate", "Pune")], complete=complete,
                          cache_path=tmp_path / "c.json")
    assert n == 2  # one retry, then fallback
    assert tags[0]["role_category"] == "Other"
    assert tags[0]["city"] == "Multiple / Pan-India"
    assert tags[0]["role_category"] in ROLE_CATEGORIES
    assert tags[0]["city"] in CITIES


def test_prompt_contains_no_url_or_apply_link(tmp_path):
    prompts = []

    def complete(prompt):
        prompts.append(prompt)
        return json.dumps({"results": [{"index": 0, "role_category": "Other",
                                       "city": "Pune"}]})

    tag_records([rec("Associate", "Pune", "https://secret.example/apply?id=9")],
                complete=complete, cache_path=tmp_path / "c.json")
    assert "secret.example" not in prompts[0]
    assert "http" not in prompts[0]


def test_second_run_with_no_new_jobs_makes_zero_calls(tmp_path):
    cache = tmp_path / "cache.json"
    jobs = [rec("Associate", "Pune")]

    def complete(prompt):
        return json.dumps({"results": [{"index": 0,
                                       "role_category": "Other", "city": "Pune"}]})

    _, first = tag_records(jobs, complete=complete, cache_path=cache)
    _, second = tag_records(jobs, complete=complete, cache_path=cache)
    assert first == 1
    assert second == 0
    assert load_cache(cache)


def test_cache_key_changes_when_title_or_location_changes():
    base = cache_key("id1", "SWE Intern", "Pune")
    assert base == cache_key("id1", "SWE Intern", "Pune")
    assert base != cache_key("id1", "SWE Intern", "Mumbai")
    assert base != cache_key("id1", "Data Intern", "Pune")
    assert base != cache_key("id2", "SWE Intern", "Pune")
