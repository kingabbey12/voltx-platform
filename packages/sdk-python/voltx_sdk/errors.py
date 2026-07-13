"""Mirrors the backend's ApiErrorEnvelope shape
(src/common/filters/global-exception.filter.ts)."""
from __future__ import annotations

from typing import Any, Optional


class VoltxApiError(Exception):
    def __init__(
        self,
        message: str,
        status_code: Optional[int],
        code: Optional[str] = None,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details

    @property
    def is_unauthorized(self) -> bool:
        return self.status_code == 401

    @property
    def is_forbidden(self) -> bool:
        return self.status_code == 403

    @property
    def is_not_found(self) -> bool:
        return self.status_code == 404

    @property
    def is_rate_limited(self) -> bool:
        return self.status_code == 429

    @property
    def is_network_failure(self) -> bool:
        return self.status_code is None

    def __repr__(self) -> str:
        return f"VoltxApiError(message={self.message!r}, status_code={self.status_code}, code={self.code!r})"
