"""Adapter registry. Disabled sources are importable but never fetched."""
from __future__ import annotations

from . import (
    adithya,
    iitian_vibes,
    nimrah,
    sarthzk,
    simplify,
    speedyapply,
    surya,
    vanshb03,
)

ADAPTERS = {
    "iitian_vibes": iitian_vibes.fetch,
    "simplify": simplify.fetch,
    "surya": surya.fetch,
    "nimrah": nimrah.fetch,
    "adithya": adithya.fetch,
    "speedyapply": speedyapply.fetch,
    "sarthzk": sarthzk.fetch,
    "vanshb03": vanshb03.fetch,
}

__all__ = ["ADAPTERS"]
