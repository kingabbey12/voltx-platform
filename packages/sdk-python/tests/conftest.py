from __future__ import annotations

import json
from typing import Any, Callable, List, Optional

import pytest


class FakeResponse:
    def __init__(self, status_code: int, body: Any) -> None:
        self.status_code = status_code
        self._body = body
        self.ok = 200 <= status_code < 300

    def json(self) -> Any:
        return json.loads(json.dumps(self._body))


class FakeSession:
    """Records every call and answers with responses from a queue (or a
    single handler function), standing in for requests.Session without
    hitting the network."""

    def __init__(self, handler: Optional[Callable[..., FakeResponse]] = None) -> None:
        self.calls: List[dict] = []
        self._handler = handler
        self._queue: List[FakeResponse] = []

    def queue_response(self, response: FakeResponse) -> None:
        self._queue.append(response)

    def request(self, method: str, url: str, headers=None, json=None, params=None) -> FakeResponse:  # noqa: A002
        self.calls.append({"method": method, "url": url, "headers": headers, "json": json, "params": params})
        if self._handler:
            return self._handler(method, url, headers=headers, json=json, params=params)
        return self._queue.pop(0)

    def post(self, url: str, json=None) -> FakeResponse:  # noqa: A002
        return self.request("POST", url, json=json)


@pytest.fixture
def fake_session() -> FakeSession:
    return FakeSession()
