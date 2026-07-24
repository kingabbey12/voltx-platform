import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface AgentWorkflowLinkInput {
  stepKey: string;
  agentId: string;
}

/**
 * Tracking/impact-analysis only for which Workflow steps reference which
 * Agent — never consulted by the workflow engine itself at runtime
 * (agent-step-executor.ts resolves the agent by name from the step's own
 * JSON config, unchanged). Kept in sync by WorkflowService whenever a new
 * WorkflowVersion is created: the full link set for that workflow is
 * replaced with whatever AGENT-type steps its latest DAG actually contains.
 */
@Injectable()
export class AgentWorkflowLinkRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private get links() {
    return this.prisma.system.agentWorkflowLink;
  }

  async replaceLinksForWorkflow(
    workflowId: string,
    links: AgentWorkflowLinkInput[],
  ): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.prisma.system.$transaction([
      this.links.deleteMany({ where: { workflowId } }),
      ...(links.length > 0
        ? [
            this.links.createMany({
              data: links.map((link) => ({
                organizationId: tenant.organizationId,
                workflowId,
                agentId: link.agentId,
                stepKey: link.stepKey,
              })),
            }),
          ]
        : []),
    ]);
  }

  async listByAgent(agentId: string): Promise<Array<{ workflowId: string; stepKey: string }>> {
    const tenant = this.tenantContextService.getOrThrow();
    const rows = await this.links.findMany({
      where: { agentId, organizationId: tenant.organizationId },
    });
    return rows.map((row) => ({ workflowId: row.workflowId, stepKey: row.stepKey }));
  }
}
