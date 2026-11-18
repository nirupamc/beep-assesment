"""Day-1 coverage gate.

Fetches every enabled source, applies the India filter, de-duplicates, and
prints per-source and unique totals. Read-only: writes nothing.

Run:  python pipeline/coverage.py
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline.adapters import ADAPTERS  # noqa: E402
from pipeline.adapters.base import AdapterError, dedupe, is_india_location
from pipeline.config import enabled_sources


def run() -> int:
    sources = enabled_sources()
    print(f"Enabled sources: {', '.join(s['id'] for s in sources)}\n")

    kept_records = []
    failures: list[str] = []
    print(f"{'source':<24}{'fetched':>9}{'india':>7}{'non-india':>11}")
    print("-" * 51)

    for src in sources:
        adapter = ADAPTERS.get(src["adapter"])
        try:
            assert adapter is not None
            records = adapter(src)
        except AdapterError as exc:
            failures.append(f"{src['id']}: {exc}")
            print(f"{src['id']:<24}{'FAILED':>9}")
            continue
        except Exception as exc:  # a broken adapter must not hide other sources
            failures.append(f"{src['id']}: {type(exc).__name__}: {exc}")
            print(f"{src['id']:<24}{'ERROR':>9}")
            continue

        india = [r for r in records if is_india_location(r.location_raw)]
        kept_records.extend(india)
        print(f"{src['id']:<24}{len(records):>9}{len(india):>7}{len(records) - len(india):>11}")

    unique, sources_by_id = dedupe(kept_records)
    multi = Counter(len(v) for v in sources_by_id.values())

    print("-" * 51)
    print(f"India rows before dedupe : {len(kept_records)}")
    print(f"Unique active India roles: {len(unique)}")
    print(
        "Listed by >1 source      : "
        f"{sum(1 for v in sources_by_id.values() if len(v) > 1)}"
    )
    if multi:
        print("Source-count distribution:", dict(sorted(multi.items())))

    if failures:
        print("\nSource failures:")
        for line in failures:
            print("  -", line)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run())
