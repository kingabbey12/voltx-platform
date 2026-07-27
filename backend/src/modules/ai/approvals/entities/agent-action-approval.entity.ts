export type AgentActionApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface AgentActionApprovalEntity {
  id: string;
  organizationId: string;
  agentRunId: string;
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
