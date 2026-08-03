import { Injectable, NotFoundException } from '@nestjs/common';
import { DashboardRecommendationStatus, Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  DeterministicRecommendation,
  RecommendationActionView,
  RecommendationEvidence,
  RecommendationView,
} from './dashboard-recommendation.types';

@Injectable()
export class DashboardRecommendationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async upsertDeterministic(signal: DeterministicRecommendation): Promise<RecommendationView> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const record = await this.prisma.scoped.dashboardRecommendation.upsert({
      where: { organizationId_fingerprint: { organizationId, fingerprint: signal.fingerprint } },
      create: {
        organizationId,
        fingerprint: signal.fingerprint,
        source: 'deterministic',
        category: signal.category,
        severity: signal.severity,
        title: signal.title,
        summary: signal.summary,
        explanation: signal.explanation,
        businessImpact: signal.businessImpact,
        recommendedNextStep: signal.recommendedNextStep,
        confidence: signal.confidence,
        expiresAt: signal.expiresAt,
        evidence: signal.evidence as unknown as Prisma.InputJsonValue,
        metadata: signal.metadata as Prisma.InputJsonValue,
        actions: {
          create: signal.actions.map((action) => ({
            organizationId,
            type: action.type,
            label: action.label,
            requiresApproval: action.requiresApproval,
            payload: action.payload as Prisma.InputJsonValue,
            idempotencyKey: action.idempotencyKey,
          })),
        },
      },
      update: {
        category: signal.category,
        severity: signal.severity,
        title: signal.title,
        summary: signal.summary,
        explanation: signal.explanation,
        businessImpact: signal.businessImpact,
        recommendedNextStep: signal.recommendedNextStep,
        confidence: signal.confidence,
        generatedAt: new Date(),
        expiresAt: signal.expiresAt,
        staleAt: null,
        evidence: signal.evidence as unknown as Prisma.InputJsonValue,
        metadata: signal.metadata as Prisma.InputJsonValue,
      },
      include: { actions: true },
    });
    return toView(record);
  }

  async markMissingDeterministicSignalsStale(fingerprints: string[]): Promise<void> {
    const { organizationId } = this.tenantContext.getOrThrow();
    await this.prisma.scoped.dashboardRecommendation.updateMany({
      where: {
        organizationId,
        source: 'deterministic',
        status: {
          in: [DashboardRecommendationStatus.OPEN, DashboardRecommendationStatus.APPROVED],
        },
        fingerprint: { notIn: fingerprints },
      },
      data: { staleAt: new Date() },
    });
  }

  async listActive(limit = 20): Promise<RecommendationView[]> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const records = await this.prisma.scoped.dashboardRecommendation.findMany({
      where: {
        organizationId,
        staleAt: null,
        status: {
          in: [DashboardRecommendationStatus.OPEN, DashboardRecommendationStatus.APPROVED],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { actions: true },
      orderBy: [{ severity: 'desc' }, { generatedAt: 'desc' }],
      take: limit,
    });
    return records.map(toView);
  }

  async findById(id: string): Promise<RecommendationView> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const record = await this.prisma.scoped.dashboardRecommendation.findFirst({
      where: { id, organizationId },
      include: { actions: true },
    });
    if (!record) throw new NotFoundException(`Recommendation with id "${id}" not found`);
    return toView(record);
  }

  async approve(id: string): Promise<RecommendationView> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const record = await this.prisma.scoped.dashboardRecommendation.updateMany({
      where: { id, organizationId, status: DashboardRecommendationStatus.OPEN, staleAt: null },
      data: { status: DashboardRecommendationStatus.APPROVED, approvedAt: new Date() },
    });
    if (record.count !== 1) return this.findById(id);
    return this.findById(id);
  }

  async dismiss(id: string): Promise<void> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const result = await this.prisma.scoped.dashboardRecommendation.updateMany({
      where: {
        id,
        organizationId,
        status: {
          in: [DashboardRecommendationStatus.OPEN, DashboardRecommendationStatus.APPROVED],
        },
      },
      data: { status: DashboardRecommendationStatus.DISMISSED, dismissedAt: new Date() },
    });
    if (result.count !== 1)
      throw new NotFoundException(`Open recommendation with id "${id}" not found`);
  }

  async reserveAction(
    recommendationId: string,
    actionId: string,
  ): Promise<RecommendationActionView | null> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const result = await this.prisma.scoped.dashboardRecommendationAction.updateMany({
      where: {
        id: actionId,
        recommendationId,
        organizationId,
        executedAt: null,
        OR: [
          { executionStartedAt: null },
          { executionStartedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
        ],
      },
      data: { executionStartedAt: new Date() },
    });
    if (result.count !== 1) return null;
    return this.findActionOrThrow(recommendationId, actionId);
  }

  async findActionOrThrow(
    recommendationId: string,
    actionId: string,
  ): Promise<RecommendationActionView> {
    const { organizationId } = this.tenantContext.getOrThrow();
    const action = await this.prisma.scoped.dashboardRecommendationAction.findFirst({
      where: { id: actionId, recommendationId, organizationId },
    });
    if (!action)
      throw new NotFoundException(`Recommendation action with id "${actionId}" not found`);
    return {
      id: action.id,
      type: action.type,
      label: action.label,
      requiresApproval: action.requiresApproval,
      payload: action.payload as Record<string, unknown>,
      executedAt: action.executedAt?.toISOString() ?? null,
    };
  }

  async completeAction(
    recommendationId: string,
    actionId: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    const { organizationId } = this.tenantContext.getOrThrow();
    await this.prisma.scoped.dashboardRecommendationAction.updateMany({
      where: { id: actionId, recommendationId, organizationId },
      data: {
        executionStartedAt: null,
        executedAt: new Date(),
        result: result as Prisma.InputJsonValue,
      },
    });
    await this.prisma.scoped.dashboardRecommendation.updateMany({
      where: { id: recommendationId, organizationId },
      data: { status: DashboardRecommendationStatus.COMPLETED, completedAt: new Date() },
    });
  }

  async releaseAction(recommendationId: string, actionId: string): Promise<void> {
    const { organizationId } = this.tenantContext.getOrThrow();
    await this.prisma.scoped.dashboardRecommendationAction.updateMany({
      where: { id: actionId, recommendationId, organizationId, executedAt: null },
      data: { executionStartedAt: null },
    });
  }
}

function toView(record: {
  id: string;
  category: RecommendationView['category'];
  severity: RecommendationView['severity'];
  status: RecommendationView['status'];
  title: string;
  summary: string;
  explanation: string;
  businessImpact: string;
  recommendedNextStep: string;
  confidence: number | null;
  generatedAt: Date;
  expiresAt: Date | null;
  staleAt: Date | null;
  evidence: Prisma.JsonValue;
  actions: Array<{
    id: string;
    type: RecommendationActionView['type'];
    label: string;
    requiresApproval: boolean;
    payload: Prisma.JsonValue;
    executedAt: Date | null;
  }>;
}): RecommendationView {
  return {
    id: record.id,
    category: record.category,
    severity: record.severity,
    status: record.status,
    title: record.title,
    summary: record.summary,
    explanation: record.explanation,
    businessImpact: record.businessImpact,
    recommendedNextStep: record.recommendedNextStep,
    confidence: record.confidence,
    generatedAt: record.generatedAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    staleAt: record.staleAt?.toISOString() ?? null,
    evidence: record.evidence as unknown as RecommendationEvidence[],
    actions: record.actions.map((action) => ({
      id: action.id,
      type: action.type,
      label: action.label,
      requiresApproval: action.requiresApproval,
      payload: action.payload as Record<string, unknown>,
      executedAt: action.executedAt?.toISOString() ?? null,
    })),
  };
}
