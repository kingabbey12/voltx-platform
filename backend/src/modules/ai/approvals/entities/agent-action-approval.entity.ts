export type AgentActionApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface AgentActionApprovalEntity {
  id: string;
  organizationId: string;
  agentRunId: string;
  toolName: string;
  input: Record<string, unknown>;
  status: AgentActionApprovalStatus;
  approverUserId: string | null;
  comment: string | null;
  expiresAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
}
