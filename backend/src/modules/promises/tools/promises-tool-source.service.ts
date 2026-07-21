import { Injectable, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AITool, ToolSchema } from '../../ai/tools/tool.interface';
import { mutationGrounding, searchGrounding } from '../../ai/tools/grounding.helpers';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { PromisesService } from '../promises.service';
import { ListPromisesQueryDto } from '../dto/promise.dto';

const PROMISE_STATUSES = ['PROPOSED', 'STANDING', 'FULFILLED', 'RELEASED', 'BROKEN'];

/**
 * Gives Ask/agent runs real, tenant-scoped access to promises by wrapping
 * the exact same PromisesService the REST controller calls — no parallel
 * business logic. `search_promises` is read-only (exempt from approval by
 * the `search_` name prefix, per tool-approval-policy.ts); every mutating
 * tool here has no explicit requiredPermission and doesn't match a
 * read-only prefix, so AiGatewayService's isMutatingTool() classifies it
 * as approval-required automatically — the existing "held work" /
 * AgentActionApproval flow, not a new one (docs/design/COMPANY.md §7).
 */
@Injectable()
export class PromisesToolSourceService implements DynamicToolSource, OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly promisesService: PromisesService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [
      this.buildSearchPromisesTool(),
      this.buildProposePromiseTool(),
      this.buildStandPromiseTool(),
      this.buildFulfillPromiseTool(),
      this.buildReleasePromiseTool(),
      this.buildBreakPromiseTool(),
    ];
  }

  private buildSearchPromisesTool(): AITool {
    const promisesService = this.promisesService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: `Optional status filter: ${PROMISE_STATUSES.join(', ')}.`,
        },
        ownerId: { type: 'string', description: 'Optional owner user id filter.' },
      },
    };

    return {
      name: 'search_promises',
      description:
        "Search the company's promises (commitments), optionally filtered by status or owner. Returns id, title, status, owner, due date, and parties for each match.",
      inputSchema: schema,
      async execute(input: { status?: string; ownerId?: string }) {
        const result = await promisesService.findAll({
          page: 1,
          limit: 100,
          status: input.status as ListPromisesQueryDto['status'],
          ownerId: input.ownerId,
        });
        return {
          total: result.total,
          promises: result.items.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            ownerId: item.ownerId,
            dueAt: item.dueAt,
          })),
        };
      },
      ground: searchGrounding<{ promises: Array<{ id: string; title: string }> }>({
        recordType: 'promise',
        noun: ['promise', 'promises'],
        items: (output) => output.promises.map((p) => ({ id: p.id, label: p.title })),
      }),
    };
  }

  private buildProposePromiseTool(): AITool {
    const promisesService = this.promisesService;
    const tenantContextService = this.tenantContextService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the commitment.', required: true },
        ownerId: {
          type: 'string',
          description: 'User id of the person accountable for this promise.',
          required: true,
        },
        dueAt: { type: 'string', description: 'Optional ISO 8601 due date.' },
        contactId: {
          type: 'string',
          description: 'Sales contact id standing on the other side of the promise (obligee).',
          required: true,
        },
      },
    };

    return {
      name: 'propose_promise',
      description:
        'Propose a new promise (commitment) between the company and a contact. This is a genuine, persisted mutation and requires approval.',
      inputSchema: schema,
      async execute(input: { title: string; ownerId: string; dueAt?: string; contactId: string }) {
        if (!input.title?.trim() || !input.ownerId?.trim() || !input.contactId?.trim()) {
          throw new Error('title, ownerId, and contactId are required');
        }
        const { userId } = tenantContextService.getOrThrow();
        const created = await promisesService.create(
          {
            title: input.title.trim(),
            ownerId: input.ownerId,
            dueAt: input.dueAt,
            parties: [{ role: 'OBLIGEE', contactId: input.contactId }],
          },
          userId,
        );
        return { id: created.id, title: created.title, status: created.status };
      },
      ground: mutationGrounding<{ id: string; title: string }>({
        recordType: 'promise',
        action: 'Proposed promise',
        record: (output) => ({ id: output.id, label: output.title }),
      }),
    };
  }

  private buildTransitionTool(
    name: string,
    action: 'stand' | 'fulfill' | 'release' | 'break',
    description: string,
    label: string,
  ): AITool {
    const promisesService = this.promisesService;
    const tenantContextService = this.tenantContextService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        promiseId: { type: 'string', description: 'Id of the promise.', required: true },
        note: { type: 'string', description: 'Optional note explaining the change.' },
      },
    };

    return {
      name,
      description,
      inputSchema: schema,
      async execute(input: { promiseId: string; note?: string }) {
        if (!input.promiseId?.trim()) {
          throw new Error('promiseId is required');
        }
        const { userId } = tenantContextService.getOrThrow();
        const updated = await promisesService.transition(
          input.promiseId,
          action,
          { note: input.note },
          userId,
        );
        return { id: updated.id, title: updated.title, status: updated.status };
      },
      ground: mutationGrounding<{ id: string; title: string; status: string }>({
        recordType: 'promise',
        action: label,
        record: (output) => ({ id: output.id, label: `${output.title} → ${output.status}` }),
      }),
    };
  }

  private buildStandPromiseTool(): AITool {
    return this.buildTransitionTool(
      'stand_promise',
      'stand',
      'Move a proposed promise to standing (the commitment is now active). Requires approval.',
      'Moved promise to standing',
    );
  }

  private buildFulfillPromiseTool(): AITool {
    return this.buildTransitionTool(
      'fulfill_promise',
      'fulfill',
      'Mark a standing promise as fulfilled (kept). Requires approval.',
      'Fulfilled promise',
    );
  }

  private buildReleasePromiseTool(): AITool {
    return this.buildTransitionTool(
      'release_promise',
      'release',
      'Release a proposed or standing promise (the company stops acting on it). Requires approval.',
      'Released promise',
    );
  }

  private buildBreakPromiseTool(): AITool {
    return this.buildTransitionTool(
      'break_promise',
      'break',
      'Mark a standing promise as broken. Requires approval.',
      'Marked promise as broken',
    );
  }
}
