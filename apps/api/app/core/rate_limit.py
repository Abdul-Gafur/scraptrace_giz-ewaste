"""In-process sliding-window rate limiting.

State lives in this process only, which suits a single-instance hackathon deployment. A
multi-instance deployment must replace it with a shared store (documented limitation). Keys are
hashed, bounded in number and never logged.
"""

from __future__ import annotations

import hashlib
import math
import threading
import time
from collections import OrderedDict, deque
from collections.abc import Callable


class SlidingWindowRateLimiter:
    def __init__(
        self,
        attempts: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        maximum_keys: int = 10_000,
    ) -> None:
        self._attempts = attempts
        self._window = window_seconds
        self._clock = clock
        self._maximum_keys = maximum_keys
        self._hits: OrderedDict[str, deque[float]] = OrderedDict()
        self._lock = threading.Lock()

    @staticmethod
    def key(*parts: str) -> str:
        return hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()

    def _prune(self, key: str, now: float) -> deque[float]:
        hits = self._hits.get(key)
        if hits is None:
            return deque()
        while hits and now - hits[0] >= self._window:
            hits.popleft()
        if not hits:
            del self._hits[key]
        return hits

    def retry_after(self, key: str) -> int | None:
        """Seconds until the key may try again, or None when it is within its budget."""
        with self._lock:
            now = self._clock()
            hits = self._prune(key, now)
            if len(hits) < self._attempts:
                return None
            return max(1, math.ceil(self._window - (now - hits[0])))

    def hit(self, key: str) -> None:
        with self._lock:
            now = self._clock()
            self._prune(key, now)
            hits = self._hits.setdefault(key, deque())
            hits.append(now)
            self._hits.move_to_end(key)
            while len(self._hits) > self._maximum_keys:
                self._hits.popitem(last=False)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)
