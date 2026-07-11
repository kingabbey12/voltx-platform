import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Clock,
  GitBranch,
  Globe,
  Layers,
  Plug,
  Repeat,
  ShieldCheck,
  Wrench,
  Webhook as WebhookIcon,
  Bell,
} from "lucide-react";
import type { WorkflowStepType } from "@/lib/api/workflows";

export interface StepFieldSpec {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "select" | "json";
  options?: string[];
  placeholder?: string;
}

export interface StepTypeSpec {
  type: WorkflowStepType;
  label: string;
  category: "AI" | "Communication" | "Integration" | "Control flow";
  description: string;
  icon: LucideIcon;
  fields: StepFieldSpec[];
  defaultConfig: Record<string, unknown>;
}

/** Real, already-registered tool names (Sales/Comms/Attachments) a TOOL step can call. */
export const COMMON_TOOL_NAMES: string[] = [
  "search_opportunities",
  "search_leads",
  "search_overdue_activities",
  "create_contact",
  "update_contact",
  "delete_contact",
  "create_company",
  "update_company",
  "create_deal",
  "update_deal",
  "move_pipeline_stage",
  "assign_task",
  "add_note",
  "create_task",
  "send_notification",
  "send_whatsapp_message",
  "send_sms_message",
  "comms_send_reply",
  "comms_summarize_conversation",
  "comms_draft_reply",
  "comms_extract_contact_info",
  "generate_pdf",
  "generate_contract",
  "convert_file",
  "ocr_image",
  "search_attachments",
  "get_attachment_text",
  "get_revenue_summary",
  "get_pipeline_summary",
];

export const STEP_TYPE_CATALOG: StepTypeSpec[] = [
  {
    type: "AGENT",
    label: "AI Agent",
    category: "AI",
    description: "Runs an AI agent turn with an objective and optional tool access.",
    icon: Bot,
    fields: [
      { key: "agentName", label: "Agent name", kind: "text", placeholder: "Workflow Assistant" },
      { key: "objective", label: "Objective", kind: "textarea", placeholder: "Summarize the deal and draft a welcome email." },
      { key: "maxIterations", label: "Max iterations", kind: "number" },
      { key: "maxToolCalls", label: "Max tool calls", kind: "number" },
    ],
    defaultConfig: { agentName: "Workflow Assistant", objective: "" },
  },
  {
    type: "TOOL",
    label: "Run tool",
    category: "AI",
    description: "Calls a single named tool from the AI tool catalog directly (no agent reasoning).",
    icon: Wrench,
    fields: [
      { key: "toolName", label: "Tool name", kind: "select", options: COMMON_TOOL_NAMES },
      { key: "input", label: "Input (JSON)", kind: "json", placeholder: "{}" },
    ],
    defaultConfig: { toolName: COMMON_TOOL_NAMES[0], input: {} },
  },
  {
    type: "INTEGRATION",
    label: "Integration action",
    category: "Integration",
    description: "Calls a connected third-party integration's action (Gmail, Slack, Calendar, etc.).",
    icon: Plug,
    fields: [
      { key: "provider", label: "Provider", kind: "text", placeholder: "google-gmail" },
      { key: "actionName", label: "Action", kind: "text", placeholder: "send_message" },
      { key: "connectionId", label: "Connection id (optional)", kind: "text" },
      { key: "input", label: "Input (JSON)", kind: "json", placeholder: "{}" },
    ],
    defaultConfig: { provider: "", actionName: "", input: {} },
  },
  {
    type: "API",
    label: "HTTP request",
    category: "Integration",
    description: "Calls an arbitrary external HTTP endpoint.",
    icon: Globe,
    fields: [
      { key: "method", label: "Method", kind: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
      { key: "url", label: "URL", kind: "text", placeholder: "https://api.example.com/endpoint" },
      { key: "headers", label: "Headers (JSON)", kind: "json" },
      { key: "body", label: "Body (JSON)", kind: "json" },
    ],
    defaultConfig: { method: "POST", url: "", body: {} },
  },
  {
    type: "WEBHOOK",
    label: "Send webhook",
    category: "Integration",
    description: "Posts a JSON payload to an external webhook URL.",
    icon: WebhookIcon,
    fields: [
      { key: "url", label: "Webhook URL", kind: "text", placeholder: "https://hooks.example.com/..." },
      { key: "payload", label: "Payload (JSON)", kind: "json" },
      { key: "headers", label: "Headers (JSON)", kind: "json" },
    ],
    defaultConfig: { url: "", payload: {} },
  },
  {
    type: "NOTIFICATION",
    label: "Send notification",
    category: "Communication",
    description: "Sends an in-app notification, logs a message, or posts to a webhook.",
    icon: Bell,
    fields: [
      { key: "channel", label: "Channel", kind: "select", options: ["notification", "log", "webhook"] },
      { key: "message", label: "Message", kind: "textarea" },
      { key: "userId", label: "Recipient user id (for notification channel)", kind: "text" },
      { key: "title", label: "Title (optional)", kind: "text" },
      { key: "webhookUrl", label: "Webhook URL (for webhook channel)", kind: "text" },
    ],
    defaultConfig: { channel: "notification", message: "" },
  },
  {
    type: "APPROVAL",
    label: "Require approval",
    category: "Control flow",
    description: "Pauses the run until a user with permission approves or rejects it.",
    icon: ShieldCheck,
    fields: [
      { key: "message", label: "Message shown to approver", kind: "textarea" },
      { key: "approverRole", label: "Approver role (optional)", kind: "text" },
      { key: "timeoutMs", label: "Timeout (ms, optional)", kind: "number" },
    ],
    defaultConfig: { message: "" },
  },
  {
    type: "DELAY",
    label: "Delay",
    category: "Control flow",
    description: "Pauses the run for a fixed duration before continuing.",
    icon: Clock,
    fields: [{ key: "delayMs", label: "Delay (ms)", kind: "number", placeholder: "60000" }],
    defaultConfig: { delayMs: 60000 },
  },
  {
    type: "LOOP",
    label: "Loop",
    category: "Control flow",
    description: "Iterates over an array from context and runs nested steps once per item.",
    icon: Repeat,
    fields: [
      { key: "itemsPath", label: "Items path", kind: "text", placeholder: "context.list_contacts.output.items" },
      { key: "maxIterations", label: "Max iterations (optional)", kind: "number" },
      { key: "steps", label: "Nested steps (JSON array)", kind: "json", placeholder: "[]" },
    ],
    defaultConfig: { itemsPath: "", steps: [] },
  },
  {
    type: "SWITCH",
    label: "Switch",
    category: "Control flow",
    description: "Branches to a different step id based on a resolved value.",
    icon: GitBranch,
    fields: [
      { key: "path", label: "Path to evaluate", kind: "text", placeholder: "context.check_stage.output.stage" },
      { key: "cases", label: "Cases (JSON array of {value, next})", kind: "json", placeholder: "[]" },
      { key: "defaultNext", label: "Default next step id (optional)", kind: "text" },
    ],
    defaultConfig: { path: "", cases: [] },
  },
];

export const CATEGORY_ORDER: StepTypeSpec["category"][] = [
  "AI",
  "Communication",
  "Integration",
  "Control flow",
];

export const CATEGORY_ICON: Record<StepTypeSpec["category"], LucideIcon> = {
  AI: Bot,
  Communication: Bell,
  Integration: Plug,
  "Control flow": Layers,
};

export function getStepTypeSpec(type: WorkflowStepType): StepTypeSpec {
  const spec = STEP_TYPE_CATALOG.find((s) => s.type === type);
  if (!spec) throw new Error(`Unknown step type "${type}"`);
  return spec;
}

