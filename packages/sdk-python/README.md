# voltx-sdk

Official Python SDK for the [Voltx](https://usevoltx.com) public API.

```bash
pip install voltx-sdk
```

## Usage

```python
from voltx_sdk import VoltxClient, PersonalAccessTokenAuth

voltx = VoltxClient(
    base_url="https://api.usevoltx.com/api/v1",
    auth=PersonalAccessTokenAuth(token="vpat_...", organization_id="org-id"),
)

tokens = voltx.personal_access_tokens.list()
```

### Auth modes

| Class | Fields | Header(s) sent |
| --- | --- | --- |
| `ApiKeyAuth` | `api_key` | `X-Api-Key` |
| `PersonalAccessTokenAuth` | `token`, `organization_id` | `X-Personal-Access-Token`, `X-Organization-Id` |
| `ServiceAccountTokenAuth` | `token` | `X-Service-Account-Token` |
| `OAuthAuth` | `access_token`, optionally `refresh_token` + `client_id` + `client_secret` | `Authorization: Bearer` |

When `OAuthAuth` includes a `refresh_token`, the client automatically refreshes and retries once on a 401.

### Resources

- `voltx.personal_access_tokens` — list / create / revoke
- `voltx.service_accounts` — list / create / suspend / reactivate / token issuance
- `voltx.oauth_applications` — application CRUD + the raw `/oauth/token`, `/oauth/revoke`, `/oauth/introspect` grant/lifecycle calls
- `voltx.webhook_endpoints` — endpoint CRUD + delivery log + replay

### Verifying inbound webhooks

```python
from voltx_sdk import verify_webhook_signature

is_valid = verify_webhook_signature(endpoint_secret, raw_request_body, request.headers["X-Voltx-Signature"])
```

## Development

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python scripts/generate_models.py   # regenerate voltx_sdk/generated/schema.py against a running local backend
pytest
```

`voltx_sdk/generated/schema.py` is generated from the backend's live OpenAPI 3.1 document
(`GET /api-json`) via a small stdlib-only script (`scripts/generate_models.py`) — regenerate and
review the diff whenever the public API changes. Response payload types are hand-maintained in
`voltx_sdk/types.py`: NestJS Swagger cannot resolve the backend's generic `ApiSuccessResponseDto[T]`'s
`data` field to a concrete schema, so those shapes never appear in the document at all.
