from __future__ import annotations

import hashlib
import json

from schemas.portfolio_snapshot_certificate import CanonicalPortfolioSnapshotPayload


def hash_portfolio_snapshot(payload: CanonicalPortfolioSnapshotPayload) -> str:
    serialized = json.dumps(
        payload.model_dump(by_alias=True),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()
