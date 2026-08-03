export type AgentActionApprovalStatus =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface AgentActionApprovalEntity {
  id: string;
  organizationId: string;
  /** Null when the approval isn't a paused tool call (VT-205 plans). */
  agentRunId: string | null;
  /** Set instead of agentRunId for a resource-scoped approval. */
  resourceType: string | null;
  resourceId: string | null;
  toolName: string;
  input: Record<string, unknown>;
  /** Owner-facing sentence written at creation; the frontend renders this and never invents summaries. */
  summary: string | null;
  status: AgentActionApprovalStatus;
  approverUserId: string | null;
  comment: string | null;
  expiresAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
}
