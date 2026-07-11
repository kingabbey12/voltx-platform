/** Never carries the decrypted value — see WorkflowSecretService for the one place that does, transiently. */
export interface WorkflowSecretEntity {
  id: string;
  organizationId: string;
  key: string;
  description: string | null;
  createdBy: string;
  lastRotatedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
