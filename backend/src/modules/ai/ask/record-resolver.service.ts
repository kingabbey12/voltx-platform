import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from '../../sales/activities/activities.service';
import { CompaniesService } from '../../sales/companies/companies.service';
import { ContactsService } from '../../sales/contacts/contacts.service';
import { LeadsService } from '../../sales/leads/leads.service';
import { OpportunitiesService } from '../../sales/opportunities/opportunities.service';
import { AttachmentService } from '../../attachments/attachment.service';
import { ConversationService as CommsConversationService } from '../../communications/conversation/conversation.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { WorkflowService } from '../../workflows/workflow.service';

/**
 * Resolves a door to its canonical record (docs/design/ASK.md §6 "Record
 * linking", COMPANY.md §5): one immutable id, one canonical owner, one
 * label — and the one place it is read in the product, when such a place
 * exists (`route` is null for record kinds that have no standalone page
 * yet; the label still resolves, and the door simply does not navigate).
 *
 * COMPANY.md's promise and asset primitives map onto today's schema as:
 * promises-in-formation are sales.lead / sales.opportunity (both resolvable
 * here, per COMPANY.md §9's reconciliation table); assets have no backing
 * model yet, so no 'asset' type is claimed — a door type this resolver does
 * not know is NotFound, never a guess.
 *
 * Tenant isolation is inherited from the underlying services, whose
 * repositories scope every query to the tenant context's organizationId —
 * a cross-tenant id resolves to NotFound, indistinguishable from absence.
 * RBAC is enforced here per record type against the caller's permissions:
 * a denial is explained by role and never confirms the record exists.
 */

export interface ResolvedRecord {
  type: string;
  id: string;
  label: string;
  /** The canonical place this record is read, or null when no page exists yet. */
  route: string | null;
}

interface RecordTypeBinding {
  permission: string;
  resolve: (id: string) => Promise<{ label: string; route: string | null }>;
}

@Injectable()
export class RecordResolverService {
  private readonly bindings: Record<string, RecordTypeBinding>;

  constructor(
    companiesService: CompaniesService,
    contactsService: ContactsService,
    leadsService: LeadsService,
    opportunitiesService: OpportunitiesService,
    activitiesService: ActivitiesService,
    attachmentService: AttachmentService,
    commsConversationService: CommsConversationService,
    knowledgeService: KnowledgeService,
    workflowService: WorkflowService,
  ) {
    this.bindings = {
      'sales.company': {
        permission: 'sales.company.read',
        resolve: async (id) => {
          const company = await companiesService.findOne(id);
          return { label: company.name, route: `/crm/companies/${id}` };
        },
      },
      'sales.contact': {
        permission: 'sales.contact.read',
        resolve: async (id) => {
          const contact = await contactsService.findOne(id);
          return {
            label: `${contact.firstName} ${contact.lastName}`.trim(),
            route: `/crm/contacts`,
          };
        },
      },
      'sales.lead': {
        permission: 'sales.lead.read',
        resolve: async (id) => {
          const lead = await leadsService.findOne(id);
          return { label: lead.title, route: `/crm/leads` };
        },
      },
      'sales.opportunity': {
        permission: 'sales.opportunity.read',
        resolve: async (id) => {
          const opportunity = await opportunitiesService.findOne(id);
          return { label: opportunity.title, route: `/crm/opportunities` };
        },
      },
      'sales.activity': {
        permission: 'sales.activity.read',
        resolve: async (id) => {
          const activity = await activitiesService.findOne(id);
          return { label: activity.subject, route: `/crm` };
        },
      },
      document: {
        permission: 'attachment.read',
        resolve: async (id) => {
          const attachment = await attachmentService.getById(id);
          // No standalone document page exists yet — the label resolves,
          // the door does not navigate.
          return { label: attachment.fileName, route: null };
        },
      },
      conversation: {
        permission: 'communications.conversation.read',
        resolve: async (id) => {
          const conversation = await commsConversationService.getConversationOrThrow(id);
          return { label: conversation.subject ?? 'Conversation', route: `/inbox` };
        },
      },
      'knowledge.document': {
        permission: 'knowledge.document.read',
        resolve: async (id) => {
          const document = await knowledgeService.getDocumentOrThrow(id);
          return { label: document.title, route: null };
        },
      },
      'knowledge.source': {
        permission: 'knowledge.source.read',
        resolve: async (id) => {
          const source = await knowledgeService.getSourceOrThrow(id);
          return { label: source.name, route: null };
        },
      },
      workflow: {
        permission: 'workflow.read',
        resolve: async (id) => {
          const workflow = await workflowService.getWorkflowOrThrow(id);
          return { label: workflow.name, route: `/workflows/${id}/builder` };
        },
      },
    };
  }

  supportedTypes(): string[] {
    return Object.keys(this.bindings);
  }

  async resolve(type: string, id: string, grantedPermissions: string[]): Promise<ResolvedRecord> {
    const binding = this.bindings[type];
    if (!binding) {
      throw new NotFoundException(`Unknown record type "${type}"`);
    }
    if (!grantedPermissions.includes(binding.permission)) {
      // Denial names the role boundary, not the record.
      throw new ForbiddenException("That's outside what your role can see.");
    }
    const { label, route } = await binding.resolve(id);
    return { type, id, label, route };
  }
}
