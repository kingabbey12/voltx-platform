/**
 * v2.2 Compliance Center — the maintained registry of every model in the
 * schema (as of this phase) that carries personal data tied to a platform
 * `User` account, and what GDPR export/erasure does with each one.
 *
 * This exists specifically to avoid the "breadth" failure mode called out
 * in the Phase 5 plan: a one-off export/delete function hand-written per
 * model silently misses whatever the author forgot, and silently stays
 * wrong as new modules are added. Instead, GdprService iterates this array
 * — extending GDPR coverage to a new model is a one-line registry entry,
 * not a new code path, and the entries here double as the audit trail of
 * exactly what was considered and why.
 *
 * SCOPE (confirmed by grepping backend/prisma/schema.prisma for every
 * userId/ownerId/authorId/senderId/uploadedBy/createdBy-style column, as of
 * this phase):
 *
 * Included below, either fully actioned or deliberately EXCLUDED with a
 * documented reason: Membership, Conversation, Memory, AiUsageLog,
 * Notification, MessageReaction, Invitation (both invitedBy/acceptedBy),
 * AuditLog, ConsentRecord, Attachment, AttachmentVersion, CommsMessage,
 * CommsNote, CommsParticipant.
 *
 * Handled OUTSIDE this registry, directly in GdprService, because they are
 * global (not organizationId-scoped) and only in scope once a user has no
 * remaining active membership anywhere on the platform: User (the root
 * profile record — anonymized in place, never hard-deleted, so every FK
 * referencing it stays intact), RefreshToken, VerificationToken (deleted —
 * these are pure session/security artifacts with no standalone value).
 *
 * Deliberately OUT OF SCOPE, not present anywhere in this module:
 *  - SalesCompany/SalesContact/SalesLead/SalesOpportunity/SalesActivity —
 *    CRM records describe external prospects/customers, not platform User
 *    accounts; none of these models has a userId/ownerId FK to User at all.
 *  - Workflow/WorkflowVersion/WorkflowTemplate/WorkflowSecret.createdBy,
 *    IntegrationConnection.createdBy, CommsChannelConnection.createdBy —
 *    these attribute who configured a piece of shared org infrastructure
 *    (an automation, an integration, a channel connection), not personal
 *    data describing that person. Anonymizing/deleting them would degrade
 *    or break live configuration other org members depend on, for a
 *    column that is closer to an audit-trail actor reference (like
 *    AuditLog.userId, itself excluded below) than to personal data.
 */

import { randomUUID } from 'node:crypto';

export type PiiErasureAction =
  | { readonly kind: 'DELETE' }
  | { readonly kind: 'ANONYMIZE'; readonly buildData: () => Record<string, unknown> }
  | { readonly kind: 'EXCLUDED'; readonly reason: string };

export interface PiiRegistryEntry {
  /** Property name on PrismaClient (e.g. `prisma.system.conversation`). */
  readonly model: string;
  /** Human label surfaced in the export payload and audit metadata. */
  readonly label: string;
  /** Column identifying the data subject on this model. */
  readonly userIdField: string;
  /** Every entry below is organizationId-scoped — erasure/export only ever
   * touches rows in the organization making the request. */
  readonly organizationScoped: true;
  readonly erasure: PiiErasureAction;
  /** Why this entry has the erasure strategy it has — kept next to the
   * data so the reasoning travels with any future audit of this file. */
  readonly notes: string;
}

function tombstoneEmail(): string {
  return `erased-${randomUUID()}@erased.invalid`;
}

export const PII_REGISTRY: readonly PiiRegistryEntry[] = [
  {
    model: 'membership',
    label: 'Organization membership',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: { kind: 'ANONYMIZE', buildData: () => ({ status: 'INACTIVE' }) },
    notes:
      'No PII columns on this model beyond the userId/roleId FKs — erasure revokes the ' +
      'membership (status -> INACTIVE) rather than scrubbing fields, cutting off org access.',
  },
  {
    model: 'conversation',
    label: 'AI conversations',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: { kind: 'DELETE' },
    notes:
      'Hard delete. Cascades (existing ON DELETE CASCADE FKs, unchanged by this phase) remove ' +
      'every Message, ToolExecution, Memory, MemoryAccess, AgentRun (and its AgentRunStep/' +
      'AgentMessage/AgentActionApproval children), conversation-linked AiUsageLog rows, and ' +
      'WorkflowRun rows tied to the deleted conversations — this is the single largest source ' +
      'of free-text personal data in the schema (actual AI chat content).',
  },
  {
    model: 'memory',
    label: 'AI long-term memories',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: { kind: 'DELETE' },
    notes:
      'Explicit, redundant with the Conversation cascade above — kept as its own registry entry ' +
      'so Memory erasure is auditable on its own line rather than an implicit side effect, and ' +
      'as defense-in-depth in case a Memory is ever attributed to a different userId than its ' +
      'owning conversation.',
  },
  {
    model: 'aiUsageLog',
    label: 'AI usage telemetry',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: { kind: 'DELETE' },
    notes:
      'Diagnostic/telemetry rows (token counts, latency, error messages), not itself billing ' +
      'evidence — org/subscription-level billing records (Invoice, UsageRecord, UsageSnapshot) ' +
      'have no userId column and are unaffected by deleting this.',
  },
  {
    model: 'notification',
    label: 'In-app notifications',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: { kind: 'DELETE' },
    notes: 'Ephemeral, user-visible feed data — safe to purge entirely.',
  },
  {
    model: 'messageReaction',
    label: 'Message emoji reactions',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: { kind: 'DELETE' },
    notes:
      'Low-risk decorative annotation on a message, not conversation content itself — unlike ' +
      'CommsMessage/CommsNote/CommsParticipant below, deleting a reaction cannot corrupt a ' +
      'shared conversation thread for the other participant.',
  },
  {
    model: 'invitation',
    label: 'Invitations sent by this user',
    userIdField: 'invitedByUserId',
    organizationScoped: true,
    erasure: {
      kind: 'EXCLUDED',
      reason:
        "The email column on Invitation is the invitee's address, not the inviter's — this row " +
        'carries no PII about the inviter beyond the FK itself, which is retained (like ' +
        'AuditLog.userId) as an administrative attribution.',
    },
    notes: 'Export-only; see erasure.reason.',
  },
  {
    model: 'invitation',
    label: 'Invitations accepted by this user',
    userIdField: 'acceptedByUserId',
    organizationScoped: true,
    erasure: { kind: 'ANONYMIZE', buildData: () => ({ email: tombstoneEmail() }) },
    notes:
      'The email column here is a snapshot of the invitee address at send time, which is ' +
      "frequently this same user's own address — scrubbed independently of User.email since " +
      'Invitation is org-scoped data this org can redact even if the user remains active in ' +
      'other organizations.',
  },
  {
    model: 'auditLog',
    label: 'Actions logged under this account',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: {
      kind: 'EXCLUDED',
      reason:
        'Rows are part of a per-organization tamper-evident hash chain (previousHash/hash, ' +
        "computed at write time) — mutating any field would change that row's recomputed hash " +
        'and falsely flag every subsequent row as tampered in GET /compliance/audit/verify. Audit ' +
        'trail retention is also itself a legal/compliance obligation that GDPR Article 17 ' +
        'recognizes as an exception to erasure.',
    },
    notes: 'Export-only (full transparency into what was logged); never mutated by erasure.',
  },
  {
    model: 'consentRecord',
    label: 'Consent history',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: {
      kind: 'EXCLUDED',
      reason:
        'Retained as evidence of historical consent decisions (including withdrawals) — this is ' +
        'exactly the kind of record a controller needs to be able to produce after an erasure ' +
        'request to prove what consent existed and when it changed.',
    },
    notes: 'Export-only.',
  },
  {
    model: 'attachment',
    label: 'Uploaded files',
    userIdField: 'uploadedBy',
    organizationScoped: true,
    erasure: {
      kind: 'EXCLUDED',
      reason:
        'Attachments are frequently referenced by other business records via AttachmentReference ' +
        '(a CRM activity, a shared comms message) that other org members rely on — automatically ' +
        'deleting or reassigning uploadedBy risks breaking those references. Left as a documented ' +
        'manual-review item rather than an automatic action.',
    },
    notes: 'Export includes file metadata and a short-lived signed download URL per file.',
  },
  {
    model: 'attachmentVersion',
    label: 'File version history authored by this user',
    userIdField: 'createdBy',
    organizationScoped: true,
    erasure: {
      kind: 'EXCLUDED',
      reason: 'Same reasoning as Attachment above — replace-in-place history tied to shared files.',
    },
    notes: 'Export-only (metadata: version number, size, timestamp — not the historical bytes).',
  },
  {
    model: 'commsMessage',
    label: 'Messages sent by this user',
    userIdField: 'senderId',
    organizationScoped: true,
    erasure: {
      kind: 'EXCLUDED',
      reason:
        'CommsMessage\'s own schema doc comment declares it "immutable once created (no soft ' +
        'delete)" by design — status transitions are tracked via timestamps rather than mutating ' +
        'history. Erasing a sent message would corrupt the shared conversation thread as seen by ' +
        'the customer/counterparty on the other end, who has an independent interest in that ' +
        'record staying intact.',
    },
    notes:
      'Export-only. This is the most significant documented exclusion in this registry — flagged ' +
      'explicitly for legal/compliance review rather than silently applying a blanket policy.',
  },
  {
    model: 'commsNote',
    label: 'Internal notes authored by this user',
    userIdField: 'authorId',
    organizationScoped: true,
    erasure: {
      kind: 'EXCLUDED',
      reason:
        'Internal, agent-only conversation record — same thread-integrity reasoning as CommsMessage.',
    },
    notes: 'Export-only.',
  },
  {
    model: 'commsParticipant',
    label: 'Conversations this user participated in',
    userIdField: 'userId',
    organizationScoped: true,
    erasure: {
      kind: 'EXCLUDED',
      reason:
        'Participant history is part of the conversation record — removing it would misrepresent who was on a thread.',
    },
    notes: 'Export-only.',
  },
];
