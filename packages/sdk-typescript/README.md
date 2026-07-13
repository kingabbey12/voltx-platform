# @voltx/sdk

Official TypeScript/JavaScript SDK for the [Voltx](https://usevoltx.com) public API.

```bash
npm install @voltx/sdk
```

## Usage

```ts
import { VoltxClient } from "@voltx/sdk";

const voltx = new VoltxClient({
  baseUrl: "https://api.usevoltx.com/api/v1",
  auth: { mode: "personal-access-token", token: "vpat_...", organizationId: "org-id" },
});

const tokens = await voltx.personalAccessTokens.list();
```

### Auth modes

| Mode | Fields | Header(s) sent |
| --- | --- | --- |
| `api-key` | `apiKey` | `X-Api-Key` |
| `personal-access-token` | `token`, `organizationId` | `X-Personal-Access-Token`, `X-Organization-Id` |
| `service-account-token` | `token` | `X-Service-Account-Token` |
| `oauth` | `accessToken`, optionally `refreshToken` + `clientId` + `clientSecret` | `Authorization: Bearer` |

When `oauth` auth includes a `refreshToken`, the client automatically refreshes and retries once on a 401.

### Resources

- `voltx.personalAccessTokens` — list / create / revoke
- `voltx.serviceAccounts` — list / create / suspend / reactivate / token issuance
- `voltx.oauthApplications` — application CRUD + the raw `/oauth/token`, `/oauth/revoke`, `/oauth/introspect` grant/lifecycle calls
- `voltx.webhookEndpoints` — endpoint CRUD + delivery log + replay

### Verifying inbound webhooks

```ts
import { verifyWebhookSignature } from "@voltx/sdk";

const isValid = verifyWebhookSignature(endpointSecret, rawRequestBody, request.headers["x-voltx-signature"]);
```

## Development

```bash
npm run generate:types   # regenerate src/generated/schema.ts against a running local backend
npm run build            # tsc -> dist/
npm test                 # node's built-in test runner
npm run lint              # tsc --noEmit
```

`src/generated/schema.ts` is generated from the backend's live OpenAPI 3.1 document
(`GET /api-json`) via [`openapi-typescript`](https://github.com/openapi-ts/openapi-typescript) —
regenerate and review the diff whenever the public API changes. Response payload types are
hand-maintained in `src/types.ts`: NestJS Swagger cannot resolve the backend's generic
`ApiSuccessResponseDto<T>`'s `data` field to a concrete schema, so those shapes aren't present
in the generated output.
