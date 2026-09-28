"""Runs `contract_rules.mjs` against the built contract package, when it is available."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest
from apps.api.app.core.config import REPOSITORY_ROOT

SCRIPT = Path(__file__).with_name("contract_rules.mjs")
DIST = REPOSITORY_ROOT / "packages/contracts/dist/index.js"


def require_contract_build() -> None:
    if shutil.which("node") is None or not DIST.exists():
        pytest.skip("Build packages/contracts first (npm run contracts:check) to run parity tests.")


def evaluate(request: dict[str, Any]) -> dict[str, Any]:
    require_contract_build()
    completed = subprocess.run(
        ["node", str(SCRIPT)],
        input=json.dumps(request),
        capture_output=True,
        text=True,
        check=True,
        timeout=60,
    )
    return dict(json.loads(completed.stdout))
