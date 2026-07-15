# User guide

Task-oriented guide for using Voltx day to day. If you're an org
admin/owner looking for team/security/billing management, see
`docs/guides/admin-guide.md` instead.

## Account

**Sign up**: create an account at `app.usevoltx.com/register` with your
name, email, password, and (optionally) an organization name — if you skip
the organization name, one is created for you from your own name. This also
starts a free trial automatically; no payment method needed up front.

**Log in**: `app.usevoltx.com/login` with email and password. If your
organization requires MFA and you haven't enrolled yet, login is blocked
until you do — go to Security → MFA to set up an authenticator app and
save your backup codes somewhere safe (each backup code works once, for
when you don't have access to your authenticator).

**Verify your email**: after signing up, check your email for a
verification link (`app.usevoltx.com/verify-email?token=...`) — it expires
after 24 hours; if it's expired, you can request a new one from your
account settings.

**Forgot your password?**: `app.usevoltx.com/forgot-password` — enter your
email and, if an account exists for it, you'll get a reset link (valid for
1 hour). For your own security, you'll see the same confirmation message
whether or not an account exists for that email.

**Belong to more than one organization?**: use the organization switcher to
move between them without signing out.

## CRM

Under **CRM** (`app.usevoltx.com/crm`):

- **Companies** and **Contacts** — the accounts and people you're selling
  to or working with. Open a contact's detail page to draft an email to
  them with AI assistance — it drafts from context (the contact's
  history/notes), you review and send.
- **Leads** — potential deals not yet qualified. Trigger AI-assisted lead
  qualification from a lead's list row or detail page — it scores/assesses
  the lead so you can prioritize follow-up.
- **Opportunities** — qualified deals in progress. An opportunity's detail
  page can show AI-generated insights about the deal and suggest a
  next-best-action based on its current stage and activity history.
- **Activities** — calls, meetings, notes, and other logged interactions
  tied to a company/contact/lead/opportunity. For a logged meeting, AI can
  generate a summary from your notes.

## AI assistant

Under **AI** (`app.usevoltx.com/ai`) you can chat directly with an AI
assistant, or set up an **agent** — a configured assistant with a specific
role, allowed tools, and (optionally) memory of past conversations for
context. The **Operator** view gives a more autonomous, multi-step agent
experience for longer-running tasks rather than a single back-and-forth
chat.

## Marketplace

Under **Marketplace** (`app.usevoltx.com/marketplace`) you can browse apps
built by third-party developers and install the ones relevant to your
organization — installing adds whatever pages, widgets, or AI tools that
app declares directly into your Voltx workspace. **Installed** shows what
your organization currently has installed and lets you uninstall. If you're
a developer yourself, **Apps** is where you publish your own (submitted
versions go through a review before they're listed for others), and
**Payouts** shows your revenue if your app is paid.

## Notifications

The bell/inbox icon shows notifications for things relevant to you (e.g.
an AI agent run needing your approval, a workflow completing, an
invitation). Unread count is visible at a glance; mark individual
notifications or everything as read from there.

## Account & profile settings

Under **Settings** you can update your profile (name, avatar, job title,
phone), manage connected communication channels, and adjust your personal
AI memory settings (what the assistant is allowed to remember about your
conversations over time). Security-specific settings (MFA, sessions,
devices, API keys) live under **Security**, not here — see the Security
Center section of the admin guide, which applies to your own account
regardless of whether you're an org admin.
