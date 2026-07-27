import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OrganizationService } from '../organization/organization.service';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../sales/companies/companies.service';
import { ContactsService } from '../sales/contacts/contacts.service';
import { ActivitiesService } from '../sales/activities/activities.service';
import { AttachmentService } from '../attachments/attachment.service';
import { ConversationService as CommsConversationService } from '../communications/conversation/conversation.service';
import { PromisesService } from '../promises/promises.service';
import { PromiseResponseDto, PromiseEventResponseDto } from '../promises/dto/promise.dto';
import { AgentApprovalService } from '../ai/approvals/agent-approval.service';

const PROMISE_TOOL_NAMES = [
  'propose_promise',
  'stand_promise',
  'fulfill_promise',
  'release_promise',
  'break_promise',
];

const HOME_PAGE_LIMIT = 8;
const TIMELINE_LIMIT = 20;

export interface CompanyHomeSection<T> {
  available: boolean;
  reason?: string;
  total: number;
  items: T[];
}

export interface PersonSummary {
  id: string;
  name: string;
  email: string | null;
  kind: 'internal' | 'external';
}

export interface DocumentSummary {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  subject: string | null;
  channel: string;
  status: string;
  lastMessageAt: string | null;
}

export interface EventSummary {
  id: string;
  subject: string;
  type: string;
  occurredAt: string;
}

export interface PromiseSummary {
  id: string;
  title: string;
  status: string;
  ownerId: string;
  dueAt: string | null;
}

export interface ApprovalSummary {
  id: string;
  toolName: string;
  status: string;
  summary: string | null;
  approverUserId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface CompanyHomeResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    industry: string | null;
    website: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  people: CompanyHomeSection<PersonSummary>;
  documents: CompanyHomeSection<DocumentSummary>;
  conversations: CompanyHomeSection<ConversationSummary>;
  events: CompanyHomeSection<EventSummary>;
  promises: CompanyHomeSection<PromiseSummary>;
  assets: { available: false; reason: string };
}

export interface RecordTimelineResponse {
  recordType: string;
  recordId: string;
  createdAt: string;
  updatedAt: string;
  events: CompanyHomeSection<EventSummary>;
  conversations: CompanyHomeSection<ConversationSummary>;
  documents: CompanyHomeSection<DocumentSummary>;
  promises: CompanyHomeSection<PromiseSummary>;
  /** Additive field (Promises module): approval history for a promise's
   * own status-changing actions. Empty/unavailable for other record types
   * — not every canonical record has approvable actions. */
  approvals: CompanyHomeSection<ApprovalSummary>;
}

const ASSETS_UNAVAILABLE_REASON =
  'No Asset primitive exists in the schema yet (docs/design/COMPANY.md §2/§9) — this section ships as a real placeholder, not fabricated data.';

/**
 * Company home and record timeline (docs/design/COMPANY.md): a read-only
 * projection over the existing primitives — Organization is the Company,
 * People combines Users (internal parties) and SalesContacts (external
 * parties), Documents is Attachment, Conversations is CommsConversation,
 * Events is SalesActivity, and Promises is the real Promise primitive
 * (backend/src/modules/promises) — no longer approximated through
 * SalesLead/SalesOpportunity now that the module exists. No parallel
 * business logic — every section wraps the exact service the REST
 * controllers use. Sections the caller's role can't see report
 * `available: false` with a reason rather than being silently omitted or
 * faked.
 */
@Injectable()
export class CompanyService {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly usersService: UsersService,
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly activitiesService: ActivitiesService,
    private readonly attachmentService: AttachmentService,
    private readonly commsConversationService: CommsConversationService,
    private readonly promisesService: PromisesService,
    private readonly agentApprovalService: AgentApprovalService,
  ) {}

  async getHome(
    organizationId: string,
    grantedPermissions: string[],
  ): Promise<CompanyHomeResponse> {
    const has = (permission: string) => grantedPermissions.includes(permission);

    if (!has('organization.read')) {
      throw new ForbiddenException("That's outside what your role can see.");
    }
    const organization = await this.organizationService.findOne(organizationId);

    const [people, documents, conversations, events, promises] = await Promise.all([
      this.loadPeopleSection(has),
      this.loadDocumentsSection(has),
      this.loadConversationsSection(has),
      this.loadEventsSection(has),
      this.loadPromisesSection(has),
    ]);

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        industry: organization.industry,
        website: organization.website,
        status: organization.status,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
      people,
      documents,
      conversations,
      events,
      promises,
      assets: { available: false, reason: ASSETS_UNAVAILABLE_REASON },
    };
  }

  async getTimeline(
    recordType: string,
    recordId: string,
    grantedPermissions: string[],
  ): Promise<RecordTimelineResponse> {
    const has = (permission: string) => grantedPermissions.includes(permission);

    if (recordType === 'sales.company') {
      if (!has('sales.company.read')) {
        throw new ForbiddenException("That's outside what your role can see.");
      }
      const company = await this.companiesService.findOne(recordId);

      const events = has('sales.activity.read')
        ? await this.activitiesService.findAll({
            page: 1,
            limit: TIMELINE_LIMIT,
            companyId: recordId,
          })
        : null;

      const promises = await this.loadCompanyPromises(has, recordId);

      const documents = has('attachment.read')
        ? await this.attachmentService.listByReference({
            referenceType: 'CRM_COMPANY',
            referenceId: recordId,
            page: 1,
            limit: TIMELINE_LIMIT,
          })
        : null;

      const conversations = await this.loadCompanyConversations(has, recordId);

      return {
        recordType,
        recordId,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
        events: toSection(events, has('sales.activity.read'), (a) => ({
          id: a.id,
          subject: a.subject,
          type: a.type,
          occurredAt: a.occurredAt ?? a.createdAt,
        })),
        conversations,
        documents: toSection(documents, has('attachment.read'), (d) => ({
          id: d.id,
          fileName: d.fileName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          createdAt: d.createdAt.toISOString(),
        })),
        promises,
        approvals: NOT_APPLICABLE_APPROVALS,
      };
    }

    if (recordType === 'sales.contact') {
      if (!has('sales.contact.read')) {
        throw new ForbiddenException("That's outside what your role can see.");
      }
      const contact = await this.contactsService.findOne(recordId);

      const events = has('sales.activity.read')
        ? await this.activitiesService.findAll({
            page: 1,
            limit: TIMELINE_LIMIT,
            contactId: recordId,
          })
        : null;

      const promises = await this.loadContactPromises(has, recordId);

      const documents = has('attachment.read')
        ? await this.attachmentService.listByReference({
            referenceType: 'CRM_CONTACT',
            referenceId: recordId,
            page: 1,
            limit: TIMELINE_LIMIT,
          })
        : null;

      const conversations = has('communications.conversation.read')
        ? await this.commsConversationService.listConversations({
            page: 1,
            limit: TIMELINE_LIMIT,
            contactId: recordId,
          })
        : null;

      return {
        recordType,
        recordId,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
        events: toSection(events, has('sales.activity.read'), (a) => ({
          id: a.id,
          subject: a.subject,
          type: a.type,
          occurredAt: a.occurredAt ?? a.createdAt,
        })),
        conversations: toSection(conversations, has('communications.conversation.read'), (c) => ({
          id: c.id,
          subject: c.subject,
          channel: c.channel,
          status: c.status,
          lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
        })),
        documents: toSection(documents, has('attachment.read'), (d) => ({
          id: d.id,
          fileName: d.fileName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          createdAt: d.createdAt.toISOString(),
        })),
        promises,
        approvals: NOT_APPLICABLE_APPROVALS,
      };
    }

    if (recordType === 'promise') {
      if (!has('promise.read')) {
        throw new ForbiddenException("That's outside what your role can see.");
      }
      const promise = await this.promisesService.findOne(recordId);

      const events = await this.promisesService.getEvents(recordId);

      const documents = has('attachment.read')
        ? await this.attachmentService.listByReference({
            referenceType: 'PROMISE',
            referenceId: recordId,
            page: 1,
            limit: TIMELINE_LIMIT,
          })
        : null;

      const conversations = await this.loadPromiseConversations(has, promise);

      const approvals = has('ai.approval.read')
        ? await this.agentApprovalService.listForResource(PROMISE_TOOL_NAMES, 'promiseId', recordId)
        : null;

      return {
        recordType,
        recordId,
        createdAt: promise.createdAt,
        updatedAt: promise.updatedAt,
        events: {
          available: true,
          total: events.length,
          items: events.map((e) => ({
            id: e.id,
            subject: describePromiseEvent(e),
            type: e.type,
            occurredAt: e.occurredAt,
          })),
        },
        conversations,
        documents: toSection(documents, has('attachment.read'), (d) => ({
          id: d.id,
          fileName: d.fileName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          createdAt: d.createdAt.toISOString(),
        })),
        promises: {
          available: false,
          reason: "A promise's own timeline does not include related promises.",
          total: 0,
          items: [],
        },
        approvals: toSection(
          approvals ? { items: approvals, total: approvals.length } : null,
          has('ai.approval.read'),
          (a) => ({
            id: a.id,
            toolName: a.toolName,
            status: a.status,
            summary: a.summary,
            approverUserId: a.approverUserId,
            createdAt: a.createdAt.toISOString(),
            decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
          }),
        ),
      };
    }

    throw new BadRequestException(
      `Timeline is not available for record type "${recordType}" yet — only sales.company, sales.contact, and promise are wired up.`,
    );
  }

  private async loadPeopleSection(
    has: (permission: string) => boolean,
  ): Promise<CompanyHomeSection<PersonSummary>> {
    if (!has('user.read') && !has('sales.contact.read')) {
      return {
        available: false,
        reason: "That's outside what your role can see.",
        total: 0,
        items: [],
      };
    }

    const [internal, external] = await Promise.all([
      has('user.read')
        ? this.usersService.findAll({ page: 1, limit: HOME_PAGE_LIMIT })
        : Promise.resolve(null),
      has('sales.contact.read')
        ? this.contactsService.findAll({ page: 1, limit: HOME_PAGE_LIMIT })
        : Promise.resolve(null),
    ]);

    const items: PersonSummary[] = [
      ...(internal?.items.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        kind: 'internal' as const,
      })) ?? []),
      ...(external?.items.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        kind: 'external' as const,
      })) ?? []),
    ];

    return {
      available: true,
      total: (internal?.total ?? 0) + (external?.total ?? 0),
      items,
    };
  }

  private async loadDocumentsSection(
    has: (permission: string) => boolean,
  ): Promise<CompanyHomeSection<DocumentSummary>> {
    if (!has('attachment.read')) {
      return {
        available: false,
        reason: "That's outside what your role can see.",
        total: 0,
        items: [],
      };
    }
    const result = await this.attachmentService.search({ page: 1, limit: HOME_PAGE_LIMIT });
    return {
      available: true,
      total: result.total,
      items: result.items.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  private async loadConversationsSection(
    has: (permission: string) => boolean,
  ): Promise<CompanyHomeSection<ConversationSummary>> {
    if (!has('communications.conversation.read')) {
      return {
        available: false,
        reason: "That's outside what your role can see.",
        total: 0,
        items: [],
      };
    }
    const result = await this.commsConversationService.listConversations({
      page: 1,
      limit: HOME_PAGE_LIMIT,
    });
    return {
      available: true,
      total: result.total,
      items: result.items.map((c) => ({
        id: c.id,
        subject: c.subject,
        channel: c.channel,
        status: c.status,
        lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
      })),
    };
  }

  private async loadEventsSection(
    has: (permission: string) => boolean,
  ): Promise<CompanyHomeSection<EventSummary>> {
    if (!has('sales.activity.read')) {
      return {
        available: false,
        reason: "That's outside what your role can see.",
        total: 0,
        items: [],
      };
    }
    const result = await this.activitiesService.findAll({ page: 1, limit: HOME_PAGE_LIMIT });
    return {
      available: true,
      total: result.total,
      items: result.items.map((a) => ({
        id: a.id,
        subject: a.subject,
        type: a.type,
        occurredAt: a.occurredAt ?? a.createdAt,
      })),
    };
  }

  private async loadPromisesSection(
    has: (permission: string) => boolean,
  ): Promise<CompanyHomeSection<PromiseSummary>> {
    if (!has('promise.read')) {
      return {
        available: false,
        reason: "That's outside what your role can see.",
        total: 0,
        items: [],
      };
    }

    const result = await this.promisesService.findAll({ page: 1, limit: HOME_PAGE_LIMIT });
    return {
      available: true,
      total: result.total,
      items: result.items.map(toPromiseSummary),
    };
  }

  private async loadContactPromises(
    has: (permission: string) => boolean,
    contactId: string,
  ): Promise<CompanyHomeSection<PromiseSummary>> {
    if (!has('promise.read')) {
      return {
        available: false,
        reason: "That's outside what your role can see.",
        total: 0,
        items: [],
      };
    }

    const result = await this.promisesService.findAll({
      page: 1,
      limit: TIMELINE_LIMIT,
      contactId,
    });
    return {
      available: true,
      total: result.total,
      items: result.items.map(toPromiseSummary),
    };
  }

  private async loadCompanyPromises(
    has: (permission: string) => boolean,
    companyId: string,
  ): Promise<CompanyHomeSection<PromiseSummary>> {
    if (!has('promise.read') || !has('sales.contact.read')) {
      return {
        available: false,
        reason:
          "That's outside what your role can see, or company-level promises need both contact and promise read access.",
        total: 0,
        items: [],
      };
    }

    const contacts = await this.contactsService.findAll({ page: 1, limit: 50, companyId });
    const promises = await this.promisesService.findByContactIds(
      contacts.items.map((contact) => contact.id),
      TIMELINE_LIMIT,
    );

    return {
      available: true,
      total: promises.total,
      items: promises.items.map(toPromiseSummary),
    };
  }

  private async loadPromiseConversations(
    has: (permission: string) => boolean,
    promise: PromiseResponseDto,
  ): Promise<CompanyHomeSection<ConversationSummary>> {
    if (!has('communications.conversation.read')) {
      return {
        available: false,
        reason: "That's outside what your role can see.",
        total: 0,
        items: [],
      };
    }

    const contactIds = promise.parties
      .map((party) => party.contactId)
      .filter((id): id is string => Boolean(id));

    if (contactIds.length === 0) {
      return { available: true, total: 0, items: [] };
    }

    const perContact = await Promise.all(
      contactIds.map((contactId) =>
        this.commsConversationService.listConversations({ page: 1, limit: 5, contactId }),
      ),
    );
    const items = perContact
      .flatMap((result) => result.items)
      .slice(0, TIMELINE_LIMIT)
      .map((c) => ({
        id: c.id,
        subject: c.subject,
        channel: c.channel,
        status: c.status,
        lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
      }));

    return {
      available: true,
      total: perContact.reduce((sum, result) => sum + result.total, 0),
      items,
    };
  }

  private async loadCompanyConversations(
    has: (permission: string) => boolean,
    companyId: string,
  ): Promise<CompanyHomeSection<ConversationSummary>> {
    if (!has('communications.conversation.read') || !has('sales.contact.read')) {
      return {
        available: false,
        reason:
          "That's outside what your role can see, or company-level conversations need both contact and conversation read access.",
        total: 0,
        items: [],
      };
    }

    const contacts = await this.contactsService.findAll({ page: 1, limit: 50, companyId });
    const perContact = await Promise.all(
      contacts.items.map((contact) =>
        this.commsConversationService.listConversations({
          page: 1,
          limit: 5,
          contactId: contact.id,
        }),
      ),
    );
    const items = perContact
      .flatMap((result) => result.items)
      .slice(0, TIMELINE_LIMIT)
      .map((c) => ({
        id: c.id,
        subject: c.subject,
        channel: c.channel,
        status: c.status,
        lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
      }));

    return {
      available: true,
      total: perContact.reduce((sum, result) => sum + result.total, 0),
      items,
    };
  }
}

function toSection<Source, Item>(
  result: { items: Source[]; total: number } | null,
  available: boolean,
  map: (item: Source) => Item,
): CompanyHomeSection<Item> {
  if (!available || !result) {
    return {
      available: false,
      reason: "That's outside what your role can see.",
      total: 0,
      items: [],
    };
  }
  return { available: true, total: result.total, items: result.items.map(map) };
}

function toPromiseSummary(promise: PromiseResponseDto): PromiseSummary {
  return {
    id: promise.id,
    title: promise.title,
    status: promise.status,
    ownerId: promise.ownerId,
    dueAt: promise.dueAt,
  };
}

function describePromiseEvent(event: PromiseEventResponseDto): string {
  switch (event.type) {
    case 'CREATED':
      return 'Promise created';
    case 'STATUS_CHANGED': {
      const from = event.payload.from as string | undefined;
      const to = event.payload.to as string | undefined;
      const note = event.payload.note as string | undefined;
      return note ? `${from} → ${to}: ${note}` : `${from} → ${to}`;
    }
    case 'AI_RECOMMENDATION':
      return (event.payload.text as string | undefined) ?? 'AI recommendation';
    case 'NOTE_ADDED':
      return (event.payload.note as string | undefined) ?? 'Note added';
    default:
      return event.type;
  }
}

const NOT_APPLICABLE_APPROVALS: CompanyHomeSection<ApprovalSummary> = {
  available: false,
  reason: 'Approval history is tracked for promises.',
  total: 0,
  items: [],
};
