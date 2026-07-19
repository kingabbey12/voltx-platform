# voltx_sdk

Official Dart/Flutter SDK for the [Voltx](https://usevoltx.com) public API.

## Usage

```dart
import 'package:voltx_sdk/voltx_sdk.dart';

final voltx = VoltxClient(
  baseUrl: 'https://api.usevoltx.com/api/v1',
  auth: const PersonalAccessTokenAuth(token: 'vpat_...', organizationId: 'org-id'),
);

final tokens = await voltx.personalAccessTokens.list();
```

### Auth modes

| Class | Fields | Header(s) sent |
| --- | --- | --- |
| `ApiKeyAuth` | `apiKey` | `X-Api-Key` |
| `PersonalAccessTokenAuth` | `token`, `organizationId` | `X-Personal-Access-Token`, `X-Organization-Id` |
| `ServiceAccountTokenAuth` | `token` | `X-Service-Account-Token` |
| `OAuthAuth` | `accessToken`, optionally `refreshToken` + `clientId` + `clientSecret` | `Authorization: Bearer` |

When `OAuthAuth` includes a `refreshToken`, the client automatically refreshes and retries once on a 401.

### Resources

- `voltx.personalAccessTokens` — list / create / revoke
- `voltx.serviceAccounts` — list / create / suspend / reactivate / token issuance
- `voltx.oauthApplications` — application CRUD + the raw `/oauth/token`, `/oauth/revoke`, `/oauth/introspect` grant/lifecycle calls
- `voltx.webhookEndpoints` — endpoint CRUD + delivery log + replay

### Verifying inbound webhooks

```dart
import 'package:voltx_sdk/voltx_sdk.dart';

final isValid = verifyWebhookSignature(endpointSecret, rawRequestBody, request.headers['x-voltx-signature']!);
```

## Development

```bash
dart pub get
dart run tool/generate_models.dart   # regenerate lib/src/generated/schema.dart against a running local backend
dart analyze
dart test
```

This package keeps a hand-written transport/resource layer while generating request DTO models from
the backend's live OpenAPI 3.1 document (`GET /api-json`) via
`tool/generate_models.dart`. Regenerate and review the diff whenever the public API changes.
