import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PII_REGISTRY } from './pii-registry';

export interface PiiExportSection {
  model: string;
  label: string;
  rows: Record<string, unknown>[];
}

export interface PiiErasureOutcome {
  model: string;
  label: string;
  action: 'DELETE' | 'ANONYMIZE' | 'EXCLUDED';
  affected: number;
  reason?: string;
}

/**
 * Minimal shape every Prisma model delegate satisfies — narrow enough to
 * avoid `any` (banned by this repo's eslint config) while still letting the
 * PII registry above drive a single generic loop over heterogeneous models.
 */
interface GenericModelDelegate {
  findMany(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>[]>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

function getDelegate(client: PrismaClient, model: string): GenericModelDelegate {
  return (client as unknown as Record<string, GenericModelDelegate>)[model];
}

/**
 * Drives GDPR export/erasure entirely off the PII_REGISTRY manifest — see
 * that file for the full reasoning behind each model's inclusion/exclusion.
 * Callers must pass an unscoped Prisma client (PrismaService.system) since
 * every query here already filters by organizationId + the subject's own
 * FK explicitly; it does not rely on the tenant-scoping Prisma extension
 * (which only auto-scopes organization/user/membership queries anyway).
 */
@Injectable()
export class PiiRegistryService {
  async exportForUser(
    client: PrismaClient,
    organizationId: string,
    userId: string,
  ): Promise<PiiExportSection[]> {
    const sections: PiiExportSection[] = [];

    for (const entry of PII_REGISTRY) {
      const delegate = getDelegate(client, entry.model);
      const rows = await delegate.findMany({
        where: { [entry.userIdField]: userId, organizationId },
      });
      sections.push({ model: entry.model, label: entry.label, rows });
    }

    return sections;
  }

  async eraseForUser(
    client: PrismaClient,
    organizationId: string,
    userId: string,
  ): Promise<PiiErasureOutcome[]> {
    const outcomes: PiiErasureOutcome[] = [];

    for (const entry of PII_REGISTRY) {
      const where = { [entry.userIdField]: userId, organizationId };

      if (entry.erasure.kind === 'EXCLUDED') {
        outcomes.push({
          model: entry.model,
          label: entry.label,
          action: 'EXCLUDED',
          affected: 0,
          reason: entry.erasure.reason,
        });
        continue;
      }

      const delegate = getDelegate(client, entry.model);

      if (entry.erasure.kind === 'DELETE') {
        const { count } = await delegate.deleteMany({ where });
        outcomes.push({
          model: entry.model,
          label: entry.label,
          action: 'DELETE',
          affected: count,
        });
        continue;
      }

      const { count } = await delegate.updateMany({ where, data: entry.erasure.buildData() });
      outcomes.push({
        model: entry.model,
        label: entry.label,
        action: 'ANONYMIZE',
        affected: count,
      });
    }

    return outcomes;
  }
}
