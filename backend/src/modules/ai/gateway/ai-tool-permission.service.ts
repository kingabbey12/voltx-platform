import { ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Maps each registered AI tool to the RBAC permission key required to
 * invoke it, or `null` if any authenticated org member may invoke it.
 *
 * All tools registered today (see ToolModule) are generic utilities with no
 * domain sensitivity, so every entry is currently `null` — this reflects
 * real, unchanged current behavior. Give a domain tool a required
 * permission here the moment it can read or mutate business data.
 */
export const TOOL_PERMISSION_REQUIREMENTS: Readonly<Record<string, string | null>> = {
  calculator: null,
  datetime: null,
  uuid: null,
  json: null,
  http_get: null,
  http_post: null,
  search_opportunities: 'sales.opportunity.read',
  search_overdue_activities: 'sales.activity.read',
  create_task: 'sales.activity.create',
  search_leads: 'sales.lead.read',
  create_simple_workflow: 'workflow.create',
  list_failed_workflow_runs: 'workflow.read',
  comms_summarize_conversation: 'communications.conversation.read',
  comms_draft_reply: 'communications.conversation.read',
  comms_extract_contact_info: 'communications.conversation.update',
};

@Injectable()
export class AiToolPermissionService {
  assertPermitted(toolName: string, grantedPermissions: readonly string[]): void {
    const requirement = Object.prototype.hasOwnProperty.call(TOOL_PERMISSION_REQUIREMENTS, toolName)
      ? TOOL_PERMISSION_REQUIREMENTS[toolName]
      : null;

    if (!requirement) {
      return;
    }

    if (!grantedPermissions.includes(requirement)) {
      throw new ForbiddenException(
        `Missing required permission "${requirement}" for tool "${toolName}"`,
      );
    }
  }
}
