import { AITool } from '../tools/tool.interface';

/**
 * Tools that never require approval regardless of naming — pure compute
 * or read-only utilities with no domain side effects.
 */
const NEVER_REQUIRES_APPROVAL = new Set<string>([
  'calculator',
  'datetime',
  'uuid',
  'json',
  'http_get',
  'search_opportunities',
  'search_overdue_activities',
  'search_leads',
  'list_failed_workflow_runs',
  'comms_summarize_conversation',
  'comms_draft_reply',
  'get_revenue_summary',
  'get_pipeline_summary',
  'get_ai_cost_summary',
  'search_attachments',
  'get_attachment_text',
]);

/**
 * Tools that always require approval even though their name doesn't match
 * the generic read-only prefixes below — known mutations, or (for
 * http_post) inherently capable of an arbitrary external side effect.
 */
const ALWAYS_REQUIRES_APPROVAL = new Set<string>([
  'create_task',
  'create_simple_workflow',
  'comms_extract_contact_info',
  'http_post',
]);

const READ_ONLY_NAME_PREFIXES = ['search_', 'list_', 'get_'];

/**
 * Default-to-requiring-approval classifier for "approval workflows for
 * sensitive actions": explicit safe/unsafe lists first (covers every
 * hand-written tool in this codebase), then a dynamically-generated
 * tool's own derived RBAC requirement (integration_* tools — see
 * IntegrationToolSourceService, `integration.read` means non-mutating),
 * then a naming-convention fallback for anything else — conservatively
 * treating an unrecognized tool as mutating rather than silently allowing
 * it to execute unsupervised.
 */
export function isMutatingTool(toolName: string, tool?: AITool): boolean {
  if (NEVER_REQUIRES_APPROVAL.has(toolName)) {
    return false;
  }
  if (ALWAYS_REQUIRES_APPROVAL.has(toolName)) {
    return true;
  }
  if (tool?.requiredPermission !== undefined && tool.requiredPermission !== null) {
    return tool.requiredPermission !== 'integration.read';
  }
  if (READ_ONLY_NAME_PREFIXES.some((prefix) => toolName.startsWith(prefix))) {
    return false;
  }
  return true;
}
