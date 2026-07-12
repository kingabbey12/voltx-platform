import { formatBytes, formatCount } from "@/lib/format";

/** Mirrors the feature catalog seeded backend-side in prisma/seed-billing-plans.ts. */
export const FEATURE_LABELS: Record<string, string> = {
  users: "Team members",
  storage: "Storage",
  ai_requests: "AI requests",
  ai_tokens: "AI tokens",
  workflow_executions: "Workflow executions",
  crm_records: "CRM records",
  communications: "Messages sent/received",
  email_accounts: "Connected email accounts",
  whatsapp_messages: "WhatsApp messages",
  voice_minutes: "Voice minutes",
  sms_messages: "SMS messages",
  calendar_connections: "Calendar connections",
  api_requests: "API requests",
  attachments: "Attachments",
  integrations: "Active integrations",
  seats: "Seats",
};

export function featureLabel(featureKey: string): string {
  return FEATURE_LABELS[featureKey] ?? featureKey;
}

export function formatFeatureQuantity(quantity: number, unit: string): string {
  if (unit === "BYTES") return formatBytes(quantity);
  if (unit === "MINUTES") return `${formatCount(quantity)} min`;
  return formatCount(quantity);
}
