/* eslint-disable @typescript-eslint/no-explicit-any,
    @typescript-eslint/no-unsafe-return,
    @typescript-eslint/no-unsafe-call,
    @typescript-eslint/no-unsafe-member-access */

import { Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';

function getTenantOrganizationId(tenantContextService: TenantContextService): string | null {
  return tenantContextService.get()?.organizationId ?? null;
}

export function addOrgFilter<T extends { where?: unknown }>(
  args: T,
  orgId: string,
  fieldName: string,
): T {
  const existingWhere = (args.where ?? {}) as Record<string, unknown>;
  return {
    ...args,
    where: { AND: [existingWhere, { [fieldName]: orgId }] },
  };
}

function standardInterceptor(
  tenantContextService: TenantContextService,
  fieldName = 'organizationId',
) {
  const intercept = ({ args, query }: { args: any; query: any }) => {
    const orgId = getTenantOrganizationId(tenantContextService);
    return orgId ? query(addOrgFilter(args, orgId, fieldName)) : query(args);
  };
  return {
    findMany: intercept,
    findFirst: intercept,
    findFirstOrThrow: intercept,
    count: intercept,
    updateMany: intercept,
    deleteMany: intercept,
  };
}

function userInterceptor(tenantContextService: TenantContextService) {
  const intercept = ({ args, query }: { args: any; query: any }) => {
    const orgId = getTenantOrganizationId(tenantContextService);
    if (!orgId) return query(args);
    const existingWhere = (args.where ?? {}) as Record<string, unknown>;
    return query({
      ...args,
      where: {
        AND: [
          existingWhere,
          { memberships: { some: { organizationId: orgId, status: 'ACTIVE' } } },
        ],
      },
    });
  };
  return {
    findMany: intercept,
    findFirst: intercept,
    findFirstOrThrow: intercept,
    count: intercept,
  };
}

function orgInterceptor(tenantContextService: TenantContextService) {
  const readIntercept = ({ args, query }: { args: any; query: any }) => {
    const orgId = getTenantOrganizationId(tenantContextService);
    if (!orgId) return query(args);
    const existingWhere = (args.where ?? {}) as Prisma.OrganizationWhereInput;
    return query({ ...args, where: { AND: [existingWhere, { id: orgId }] } });
  };
  return {
    findMany: readIntercept,
    findFirst: readIntercept,
    findFirstOrThrow: readIntercept,
    count: readIntercept,
    update({ args, query }: { args: any; query: any }) {
      const orgId = getTenantOrganizationId(tenantContextService);
      if (orgId) args.where = { id: orgId };
      return query(args);
    },
    updateMany: readIntercept,
    delete({ args, query }: { args: any; query: any }) {
      const orgId = getTenantOrganizationId(tenantContextService);
      if (orgId) args.where = { id: orgId };
      return query(args);
    },
    deleteMany: readIntercept,
  };
}

export function createTenantPrismaExtension(tenantContextService: TenantContextService) {
  return Prisma.defineExtension({
    query: {
      agent: standardInterceptor(tenantContextService),
      agentActionApproval: standardInterceptor(tenantContextService),
      aiProviderCredential: standardInterceptor(tenantContextService),
      aiSuggestion: standardInterceptor(tenantContextService),
      aiUsageLog: standardInterceptor(tenantContextService),
      aIConversationSummary: standardInterceptor(tenantContextService),
      apiKey: standardInterceptor(tenantContextService),
      attachment: standardInterceptor(tenantContextService),
      attachmentReference: standardInterceptor(tenantContextService),
      attachmentVersion: standardInterceptor(tenantContextService),
      auditExport: standardInterceptor(tenantContextService),
      auditLog: standardInterceptor(tenantContextService),
      backgroundJobFailure: standardInterceptor(tenantContextService),
      billingAccount: standardInterceptor(tenantContextService),
      billingEvent: standardInterceptor(tenantContextService),
      brandTheme: standardInterceptor(tenantContextService),
      businessUnit: standardInterceptor(tenantContextService),
      checkoutSession: standardInterceptor(tenantContextService),
      commsCall: standardInterceptor(tenantContextService),
      commsCallRecording: standardInterceptor(tenantContextService),
      commsChannelConnection: standardInterceptor(tenantContextService),
      commsChannelCredential: standardInterceptor(tenantContextService),
      commsChannelIdentity: standardInterceptor(tenantContextService),
      commsConversation: standardInterceptor(tenantContextService),
      commsMessage: standardInterceptor(tenantContextService),
      commsNote: standardInterceptor(tenantContextService),
      commsParticipant: standardInterceptor(tenantContextService),
      commsTranscription: standardInterceptor(tenantContextService),
      communicationEvent: standardInterceptor(tenantContextService),
      consentRecord: standardInterceptor(tenantContextService),
      conversation: standardInterceptor(tenantContextService),
      conversationLabel: standardInterceptor(tenantContextService),
      costCenter: standardInterceptor(tenantContextService),
      customDomain: standardInterceptor(tenantContextService),
      customerPortalSession: standardInterceptor(tenantContextService),
      dashboardRecommendation: standardInterceptor(tenantContextService),
      dashboardRecommendationAction: standardInterceptor(tenantContextService),
      department: standardInterceptor(tenantContextService),
      developerConnectAccount: standardInterceptor(tenantContextService),
      discount: standardInterceptor(tenantContextService),
      financialBudget: standardInterceptor(tenantContextService),
      financialTransaction: standardInterceptor(tenantContextService),
      identityProvider: standardInterceptor(tenantContextService),
      integrationApiUsageLog: standardInterceptor(tenantContextService),
      aiWorkflowPlan: standardInterceptor(tenantContextService),
      integrationConnection: standardInterceptor(tenantContextService),
      integrationCredential: standardInterceptor(tenantContextService),
      integrationEvent: standardInterceptor(tenantContextService),
      integrationHealthCheck: standardInterceptor(tenantContextService),
      integrationSyncRun: standardInterceptor(tenantContextService),
      integrationWebhookEndpoint: standardInterceptor(tenantContextService),
      invoice: standardInterceptor(tenantContextService),
      invitation: standardInterceptor(tenantContextService),
      knowledgeChunk: standardInterceptor(tenantContextService),
      knowledgeDocument: standardInterceptor(tenantContextService),
      knowledgeEntity: standardInterceptor(tenantContextService),
      knowledgeRelationship: standardInterceptor(tenantContextService),
      knowledgeSearchLog: standardInterceptor(tenantContextService),
      knowledgeSource: standardInterceptor(tenantContextService),
      legalHold: standardInterceptor(tenantContextService),
      membership: standardInterceptor(tenantContextService),
      memory: standardInterceptor(tenantContextService),
      messageReaction: standardInterceptor(tenantContextService),
      notification: standardInterceptor(tenantContextService),
      oAuthApplication: standardInterceptor(tenantContextService),
      organization: orgInterceptor(tenantContextService),
      payment: standardInterceptor(tenantContextService),
      paymentMethod: standardInterceptor(tenantContextService),
      platformAlert: standardInterceptor(tenantContextService),
      promise: standardInterceptor(tenantContextService),
      promiseEvent: standardInterceptor(tenantContextService),
      promiseParty: standardInterceptor(tenantContextService),
      retentionPolicy: standardInterceptor(tenantContextService),
      salesActivity: standardInterceptor(tenantContextService),
      salesCompany: standardInterceptor(tenantContextService),
      salesContact: standardInterceptor(tenantContextService),
      salesLead: standardInterceptor(tenantContextService),
      salesOpportunity: standardInterceptor(tenantContextService),
      scimProvisionJob: standardInterceptor(tenantContextService),
      scimToken: standardInterceptor(tenantContextService),
      seatAssignment: standardInterceptor(tenantContextService),
      serviceAccount: standardInterceptor(tenantContextService),
      session: standardInterceptor(tenantContextService),
      subscription: standardInterceptor(tenantContextService),
      supportNote: standardInterceptor(tenantContextService),
      taxProfile: standardInterceptor(tenantContextService),
      team: standardInterceptor(tenantContextService),
      trustedDevice: standardInterceptor(tenantContextService),
      usageRecord: standardInterceptor(tenantContextService),
      usageSnapshot: standardInterceptor(tenantContextService),
      user: userInterceptor(tenantContextService),
      webhookEndpoint: standardInterceptor(tenantContextService),
      workflow: standardInterceptor(tenantContextService),
      workflowApproval: standardInterceptor(tenantContextService),
      workflowDeadLetter: standardInterceptor(tenantContextService),
      workflowRun: standardInterceptor(tenantContextService),
      workflowSchedule: standardInterceptor(tenantContextService),
      workflowSecret: standardInterceptor(tenantContextService),
      workflowStepRun: standardInterceptor(tenantContextService),
      workflowTemplate: standardInterceptor(tenantContextService),
      workflowVariable: standardInterceptor(tenantContextService),
      workflowVersion: standardInterceptor(tenantContextService),
      workflowWebhook: standardInterceptor(tenantContextService),
    },
  });
}
