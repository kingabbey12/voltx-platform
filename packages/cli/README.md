# @voltx/cli

Official command-line tool for the [Voltx](https://usevoltx.com) public API. Built on
[`@voltx/sdk`](../sdk-typescript) for every API call.

```bash
npm install -g @voltx/cli
```

## Commands

```bash
voltx login <token> --organization-id <id> [--base-url <url>]  # log in with a Personal Access Token
voltx logout                                                    # remove stored credentials
voltx whoami                                                     # show your organization and effective permissions

voltx deploy <file> [--workflow-id <id>] [--name <name>] [--description <desc>] [--publish]
                                                                  # push a local JSON/YAML workflow
                                                                  # definition as a new workflow (or a
                                                                  # new version of an existing one)

voltx workflows list
voltx workflows show <id>
voltx workflows run <id> [--input '{"key":"value"}']

voltx logs <runId> [--follow]                                    # print (and optionally follow) a run's logs
```

### Logging in

Create a Personal Access Token from the Developer Portal (`/developers/personal-access-tokens`)
or via `voltx`'s own SDK/API, then:

```bash
voltx login vpat_... --organization-id <your-org-id> --base-url https://api.usevoltx.com/api/v1
```

Credentials are stored at `~/.voltx/credentials` with `0600` permissions.

This is deliberately simpler than a browser-based OAuth device flow: the backend's authorization
server (v2.3 Phase 2) supports `authorization_code`+PKCE and `refresh_token` grants, not a
`device_code` grant, and a genuine loopback-redirect OAuth flow would additionally require a new
web consent-screen page. A pasted Personal Access Token is the same "create a token on the
dashboard, paste it here" pattern most CLIs (`gh`, `heroku`, `stripe`) use for exactly this case,
and is fully real today with zero placeholder behavior.

### Deploying a workflow

A manifest file can be either a full manifest:

```json
{
  "name": "New Deal Onboarding",
  "description": "Runs when a new opportunity is marked closed-won.",
  "definition": {
    "steps": [
      { "id": "summarize", "name": "Summarize the deal", "type": "AGENT", "config": { "agentName": "Sales Assistant", "objective": "Summarize the closed-won deal." } }
    ]
  }
}
```

or a bare definition (in which case `--name` is required to create a new workflow, or
`--workflow-id` to deploy a new version of an existing one):

```json
{
  "steps": [{ "id": "summarize", "name": "Summarize the deal", "type": "AGENT", "config": { "agentName": "Sales Assistant", "objective": "..." } }]
}
```

YAML manifests (`.yaml`/`.yml`) are also supported.

## Development

```bash
npm install
npm run build
npm test
```

This package depends on `@voltx/sdk` via a local `file:` reference (no root npm workspace exists
in this monorepo — see the root `CLAUDE.md`), so `packages/sdk-typescript` must be built
(`npm run build`) before this package's `dist/` will resolve it correctly.
