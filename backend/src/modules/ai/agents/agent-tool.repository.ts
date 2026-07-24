import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface AgentToolInput {
  toolName: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Canonical per-agent tool allowlist (promotes Agent.configuration.toolNames
 * out of a JSON blob into a real, queryable, versioned table). Every method
 * distinguishes "no AgentTool rows exist for this agent/version" (returns
 * null) from "explicitly zero tools allowed" (returns []) so AgentFactory can
 * fall back to the legacy configuration.toolNames JSON field for any agent
 * that predates this table — which includes every one of the 10 hardcoded
 * system agents, none of which ever get AgentTool rows written.
 */
@Injectable()
export class AgentToolRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private get tools() {
    return this.prisma.system.agentTool;
  }

  /**
   * Replaces the live (agentVersionId: null) tool allowlist for an agent —
   * delete-then-recreate inside a transaction so a shrinking tool list never
   * leaves an orphaned row behind.
   */
  async replaceToolsForAgent(agentId: string, tools: AgentToolInput[]): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.prisma.system.$transaction([
      this.tools.deleteMany({ where: { agentId, agentVersionId: null } }),
      ...(tools.length > 0
        ? [
            this.tools.createMany({
              data: tools.map((tool) => ({
                organizationId: tenant.organizationId,
                agentId,
                agentVersionId: null,
                toolName: tool.toolName,
                enabled: tool.enabled ?? true,
                config: (tool.config ?? {}) as Prisma.InputJsonValue,
              })),
            }),
          ]
        : []),
    ]);
  }

  /**
   * Copies the agent's current live tool rows onto an immutable
   * AgentVersion snapshot at publish time, so the version stays correct
   * even if the live allowlist changes afterward.
   */
  async snapshotToolsForVersion(agentId: string, agentVersionId: string): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    const liveTools = await this.tools.findMany({ where: { agentId, agentVersionId: null } });
    if (liveTools.length === 0) {
      return;
    }
    await this.tools.createMany({
      data: liveTools.map((tool) => ({
        organizationId: tenant.organizationId,
        agentId,
        agentVersionId,
        toolName: tool.toolName,
        enabled: tool.enabled,
        config: (tool.config ?? {}) as Prisma.InputJsonValue,
      })),
    });
  }

  /**
   * Returns enabled tool names for the given agent/version, or `null` when
   * zero AgentTool rows exist at all for that scope (signaling the caller
   * should fall back to configuration.toolNames). Pass `agentVersionId:
   * null` for the live/draft agent's own tool set.
   */
  async listToolNamesForAgent(
    agentId: string,
    agentVersionId: string | null,
  ): Promise<string[] | null> {
    const rows = await this.tools.findMany({ where: { agentId, agentVersionId } });
    if (rows.length === 0) {
      return null;
    }
    return rows.filter((row) => row.enabled).map((row) => row.toolName);
  }
}
