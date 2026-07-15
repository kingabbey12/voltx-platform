# Admin guide

For an organization owner/admin. If you're looking for local development or
deployment instructions, see `docs/architecture/` and `docs/deployment/`
instead — this doc is entirely about using the product.

## Team & roles

**Settings → Team** (`app.usevoltx.com/settings/team`) is where you invite
teammates: enter an email and pick a role, and an invitation is created
(status `PENDING`). From that same screen you can resend or revoke a
pending invitation. Whoever you invited accepts the invitation link either
as a brand-new account or, if they already have a Voltx account, by
accepting into an existing one — either way they land in your organization
with the role you picked.

Voltx ships five built-in roles (Owner, Admin, Manager, Member, Viewer) that
are shared, read-only, and always available. **Settings → Roles**
(`app.usevoltx.com/settings/roles`) is where you go beyond those: create a
custom role scoped to just your organization, name it, and check off exactly
the permissions it should grant from the full catalog (grouped by resource —
expand a group to see its individual permissions). Custom roles show up
alongside the built-in ones everywhere a role is picked, including the
invite dialog. You can edit or delete a custom role at any time from the
same screen — deleting one that still has members assigned is blocked until
you reassign them. System roles can't be edited or deleted (no delete/edit
menu appears for them), and the `owner` role specifically can't be assigned
via invitation at all — it's set on whoever created the organization.

A single person can belong to more than one organization. If they do, a
switcher lets them move between organizations without signing out — each
org's data is fully isolated regardless of how many they belong to.

## Security policies

Under an organization's security settings you can require every member to
enroll in multi-factor authentication before they're allowed to sign in.
Turning this on doesn't retroactively lock out members who haven't enrolled
yet on their *next* login attempt — it hard-blocks login with a clear
message until they complete MFA setup, rather than silently letting them
through (a policy that could be routed around by simply never enrolling
wouldn't be much of a policy). You can also configure a password policy
(minimum length, character requirements) and an IP allowlist restricting
which addresses/ranges can authenticate at all.

## Security Center

Under **Security** (`app.usevoltx.com/security`):

- **MFA** — enroll/disable your own TOTP-based two-factor authentication,
  view and regenerate backup codes.
- **Sessions** — every active login, with device/IP/last-active info; revoke
  any of them remotely (e.g. a lost laptop) — revoking a session
  immediately invalidates every refresh token issued under it, not just the
  most recent one.
- **Login history** — every past login attempt for your account, active or
  since-revoked.
- **Devices** — trusted devices that can bypass an MFA challenge for a
  configured window after the last successful MFA verification on that
  device.
- **API keys** — personal API keys for scripting/automation against the
  Voltx API, separate from the Developer Portal's OAuth apps and service
  accounts below.

## Compliance Center

Under **Compliance** (`app.usevoltx.com/compliance`) — this is backed by
real data, not a static page:

- **Audit** — search and export the organization's audit log, and verify
  its tamper-evident hash chain (confirms nobody has edited history — see
  `docs/architecture/data-model.md` for how the chain works). Every
  sensitive action across the platform writes here: logins, permission
  changes, billing changes, data exports, and more.
- **GDPR** — export a member's personal data, or request erasure/anonymization
  of it. An erasure request is blocked automatically if the person is under
  an active legal hold (below) — you'll need to release the hold first.
- **Retention** — define how long different kinds of data are kept before
  automatic removal is enforced.
- **Legal holds** — place a hold on a user's data to suspend deletion
  (including GDPR erasure) while it's active — e.g. for litigation or an
  ongoing investigation.

## Billing

Under **Billing** you manage your subscription plan, payment method (via
Stripe), and view past invoices. New organizations start on a real trial
automatically at signup — no payment method required until the trial
converts or you upgrade early. Upgrading/downgrading is prorated
automatically through Stripe's Customer Portal integration.

## Developer Portal

Under **Developers** (`app.usevoltx.com/developers`) — for teams building
against or integrating with the Voltx API:

- **OAuth applications** — register a third-party app that can request
  access to a user's Voltx data via OAuth 2.0 (Voltx acting as the
  authorization server).
- **Webhooks** — subscribe to outbound event notifications from Voltx
  (deliveries are signed and retried with backoff on failure).
- **Personal access tokens** — long-lived tokens for scripting, distinct
  from a Security Center API key.
- **Service accounts** — non-human identities for machine-to-machine
  integrations that shouldn't be tied to one person's account.
- **API docs / Playground** — interactive Swagger UI and a request
  playground for exploring the API without leaving the browser.

## Marketplace apps

Organizations can browse and install third-party apps from the Marketplace,
and — if you're a developer — publish your own (subject to review before
it's listed for others). Installing a paid app runs its payment through
Stripe Connect automatically; you don't need a separate billing
relationship with the app's developer.
