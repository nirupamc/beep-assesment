"""Tagger tests: rules first, enum-validated LLM only for leftovers, caching."""
from __future__ import annotations

import json

import pytest

from pipeline.adapters.base import JobRecord, job_id
from pipeline.tagger import (
    CITIES,
    EXPERIENCE_TYPES,
    RULES_VERSION,
    ROLE_CATEGORIES,
    _default_complete,
    cache_key,
    load_cache,
    role_from_rules,
    city_from_rules,
    experience_from_rules,
    save_cache,
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
    assert tags[0]["city"] == "Pune"  # rule-resolved city beats the fallback
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


def test_cache_key_includes_rules_version():
    assert cache_key("id1", "SWE Intern", "Pune") != cache_key(
        "id1", "SWE Intern", "Pune", rules_version=RULES_VERSION - 1)
    assert str(RULES_VERSION) in cache_key("id1", "SWE Intern", "Pune")


def test_stale_cache_experience_does_not_override_rules(tmp_path):
    cache_path = tmp_path / "cache.json"
    job = rec("Software Engineer - 3 years")
    save_cache({cache_key(job_id(job), job.title, job.location_raw): {
        "role_category": "Other",
        "city": "Multiple / Pan-India",
        "experience_type": "Fresher / New Grad",
    }}, cache_path)

    tags, calls = tag_records([job], complete=lambda p: "", cache_path=cache_path)
    assert calls == 0
    assert tags[0]["experience_type"] == "Experienced"
    assert tags[0]["city"] == "Bengaluru"
    assert tags[0]["role_category"] == "Software Engineering"


def test_stale_cached_city_does_not_override_rule_city(tmp_path):
    cache_path = tmp_path / "cache.json"
    job = rec("Vadodara Data Engineer", "Vadodara, India")
    save_cache({cache_key(job_id(job), job.title, job.location_raw): {
        "city": "Multiple / Pan-India",
        "experience_type": "Fresher / New Grad",
    }}, cache_path)

    tags, _ = tag_records([job], complete=lambda p: "", cache_path=cache_path)
    assert tags[0]["city"] == "Vadodara"
    assert tags[0]["experience_type"] == "Unspecified"


def test_cache_stores_only_llm_resolved_role_and_city(tmp_path):
    cache_path = tmp_path / "cache.json"
    job = rec("Campus Ambassador", "Pune")

    def complete(prompt):
        return json.dumps({"results": [{"index": 0,
                                       "role_category": "Product / Design",
                                       "city": "Pune"}]})

    tag_records([job], complete=complete, cache_path=cache_path)
    entries = list(load_cache(cache_path).values())
    assert entries == [{"role_category": "Product / Design"}]


def test_rules_resolved_rows_are_not_cached(tmp_path):
    cache_path = tmp_path / "cache.json"
    tag_records([rec("Software Engineer Intern")], complete=lambda p: "",
                cache_path=cache_path)
    assert load_cache(cache_path) == {}


def test_years_based_title_is_experienced():
    assert experience_from_rules("Software Engineer - 1 to 4 Years") == "Experienced"
    assert experience_from_rules("Backend Developer (3 years)") == "Experienced"
    assert experience_from_rules("Senior Engineer 5+ years") == "Experienced"
    assert experience_from_rules("Data Scientist 2 Years Experience") == "Experienced"


def test_internship_and_fresher_still_recognised():
    assert experience_from_rules("Software Engineer Intern") == "Internship"
    assert experience_from_rules("Fresher Software Engineer") == "Fresher / New Grad"


def test_unspecified_when_no_signal():
    assert experience_from_rules("Software Engineer") is None
    # tag_from_rules falls back to Unspecified
    from pipeline.tagger import tag_from_rules
    assert tag_from_rules("Software Engineer", "Bengaluru, India")["experience_type"] == "Unspecified"


def test_experienced_never_fresher():
    from pipeline.tagger import tag_from_rules
    tag = tag_from_rules("DevOps Engineer - 1 to 4 Years", "Bengaluru, India")
    assert tag["experience_type"] == "Experienced"
    assert tag["experience_type"] != "Fresher / New Grad"


def test_expanded_city_dictionary():
    for city in ["Vadodara", "Ahmedabad", "Jaipur", "Kochi", "Chandigarh",
                 "Coimbatore", "Indore", "Lucknow", "Bhubaneswar", "Surat",
                 "Nagpur", "Thiruvananthapuram"]:
        assert city_from_rules(f"{city}, India") == city, city


def test_other_india_for_unrecognised_single_city():
    assert city_from_rules("Ranchi, India") == "Other India"
    assert city_from_rules("Patna, India") == "Other India"


def test_experience_types_and_cities_include_new_values():
    assert "Experienced" in EXPERIENCE_TYPES
    assert "Unspecified" in EXPERIENCE_TYPES
    assert "Other India" in CITIES


def test_software_and_systems_analyst_are_not_data_science():
    assert role_from_rules("Software Analyst") != "Data Science & Analytics"
    assert role_from_rules("Systems Analyst") != "Data Science & Analytics"
    assert role_from_rules("Business Systems Analyst") != "Data Science & Analytics"
    # genuine data roles still match
    assert role_from_rules("Data Analyst") == "Data Science & Analytics"
    assert role_from_rules("Analytics Intern") == "Data Science & Analytics"


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


def test_openai_compatible_provider_uses_base_url_and_json_mode(monkeypatch):
    captured = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return _FakeResponse('{"results":[]}')

    class FakeClient:
        def __init__(self, **kwargs):
            captured["client"] = kwargs
            self.chat = type("Chat", (), {"completions": FakeCompletions()})()

    monkeypatch.setattr("openai.OpenAI", FakeClient)
    monkeypatch.setenv("LLM_PROVIDER", "openai-compatible")
    monkeypatch.setenv("LLM_BASE_URL", "https://llm.example/v1")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("LLM_API_KEY", "test-key")

    assert _default_complete("hello") == '{"results":[]}'
    assert captured["client"]["base_url"] == "https://llm.example/v1"
    assert captured["response_format"] == {"type": "json_object"}
    assert captured["messages"][0]["content"] == "hello"
    assert captured["temperature"] == 0


def test_openai_compatible_retries_without_response_format(monkeypatch):
    attempts = []

    class FakeCompletions:
        def create(self, **kwargs):
            attempts.append(dict(kwargs))
            if "response_format" in kwargs:
                raise TypeError("response_format is not supported")
            return _FakeResponse("plain")

    class FakeClient:
        def __init__(self, **kwargs):
            self.chat = type("Chat", (), {"completions": FakeCompletions()})()

    monkeypatch.setattr("openai.OpenAI", FakeClient)
    monkeypatch.setenv("LLM_PROVIDER", "openai-compatible")
    monkeypatch.setenv("LLM_BASE_URL", "https://llm.example/v1")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("LLM_API_KEY", "test-key")

    assert _default_complete("hello") == "plain"
    assert len(attempts) == 2
    assert "response_format" in attempts[0]
    assert "response_format" not in attempts[1]
