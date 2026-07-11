/** Never carries encryptedSecret — see WorkflowWebhookService for signature verification, which decrypts transiently. */
export interface WorkflowWebhookEntity {
  id: string;
  organizationId: string;
  workflowId: string;
  token: string;
  enabled: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
