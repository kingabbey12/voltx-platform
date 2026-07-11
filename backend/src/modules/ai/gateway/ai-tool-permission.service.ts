import { ForbiddenException, Injectable } from '@nestjs/common';
import { ToolRegistry } from '../tools/tool.registry';

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
  get_revenue_summary: 'sales.opportunity.read',
  get_pipeline_summary: 'sales.opportunity.read',
  get_ai_cost_summary: 'ai.agent.read',
  search_attachments: 'attachment.read',
  get_attachment_text: 'attachment.read',
  create_contact: 'sales.contact.create',
  update_contact: 'sales.contact.update',
  delete_contact: 'sales.contact.delete',
  create_company: 'sales.company.create',
  update_company: 'sales.company.update',
  create_deal: 'sales.opportunity.create',
  update_deal: 'sales.opportunity.update',
  move_pipeline_stage: 'sales.opportunity.update',
  assign_task: 'sales.activity.update',
  add_note: 'sales.activity.create',
  send_notification: 'notification.send',
  comms_send_reply: 'communications.message.create',
  send_whatsapp_message: 'communications.message.create',
  send_sms_message: 'communications.message.create',
  generate_pdf: 'attachment.create',
  generate_contract: 'attachment.create',
  convert_file: 'attachment.create',
  ocr_image: 'attachment.create',
};

@Injectable()
export class AiToolPermissionService {
  constructor(private readonly toolRegistry: ToolRegistry) {}

  assertPermitted(toolName: string, grantedPermissions: readonly string[]): void {
    const requirement = this.resolveRequirement(toolName);

    if (!requirement) {
      return;
    }

    if (!grantedPermissions.includes(requirement)) {
      throw new ForbiddenException(
        `Missing required permission "${requirement}" for tool "${toolName}"`,
      );
    }
  }

  /**
   * The central map is authoritative when it has an entry (every
   * hand-written tool in this codebase should be listed there). Falls
   * back to the tool's own declared `requiredPermission` — set by
   * dynamically-generated tool sources like IntegrationToolSourceService,
   * which can't be centrally hand-maintained one entry per connector
   * action — rather than defaulting an unlisted tool to unrestricted.
   */
  private resolveRequirement(toolName: string): string | null {
    if (Object.prototype.hasOwnProperty.call(TOOL_PERMISSION_REQUIREMENTS, toolName)) {
      return TOOL_PERMISSION_REQUIREMENTS[toolName];
    }

    try {
      return this.toolRegistry.get(toolName).requiredPermission ?? null;
    } catch {
      return null;
    }
  }
}
