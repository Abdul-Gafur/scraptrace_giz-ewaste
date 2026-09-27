"""Conservative response headers for an API that returns personal and evidentiary data."""

from __future__ import annotations

from starlette.types import ASGIApp, Message, Receive, Scope, Send

_ALWAYS = (
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-frame-options", b"DENY"),
    (b"cross-origin-resource-policy", b"same-site"),
)


class SecurityHeadersMiddleware:
    """Adds hardening headers, and `Cache-Control: no-store` to versioned API responses so
    records, tokens and evidence are never stored by shared caches."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        versioned = str(scope.get("path", "")).startswith("/v1/")

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                headers.extend(pair for pair in _ALWAYS if pair[0] not in present)
                if versioned and b"cache-control" not in present:
                    headers.append((b"cache-control", b"no-store"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)
