import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { WorkflowToolSourceService } from '../src/modules/workflows/tools/workflow-tool-source.service';
import { WorkflowService } from '../src/modules/workflows/workflow.service';
import { AITool } from '../src/modules/ai/tools/tool.interface';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

function chatEventsFor(text: string) {
  return (async function* stream() {
    await Promise.resolve();
    yield {
      type: 'message_end' as const,
      provider: 'openai' as const,
      model: 'gpt-5-mini',
      outputText: text,
    };
  })();
}

describe('Workflow AI generation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let modelRegistryService: ModelRegistryService;
  let aiRuntimeService: AIRuntimeService;
  let workflowToolSourceService: WorkflowToolSourceService;
  let workflowService: WorkflowService;
  let tenantContextService: TenantContextService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    modelRegistryService = app.get(ModelRegistryService);
    aiRuntimeService = app.get(AIRuntimeService);
    workflowToolSourceService = app.get(WorkflowToolSourceService);
    workflowService = app.get(WorkflowService);
    tenantContextService = app.get(TenantContextService);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await resetAndSeedAuthTestData(prisma);

    jest.spyOn(modelRegistryService, 'resolveProviderAndModel').mockResolvedValue({
      provider: { name: 'openai' } as never,
      model: {
        id: 'gpt-5-mini',
        provider: 'openai',
        family: 'gpt-5',
        displayName: 'GPT-5 Mini',
        supportsStreaming: true,
        supportsEmbeddings: false,
      } as never,
    });
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  function findTool(name: string): AITool {
    const tool = workflowToolSourceService.listTools().find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`tool "${name}" not found`);
    return tool;
  }

  async function withTenant<T>(
    organizationId: string,
    userId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return tenantContextService.run(
      { organizationId, userId, membershipId: 'test-membership', requestId: 'test-request' },
      fn,
    );
  }

  it('generates a valid multi-step workflow definition and creates a real draft workflow', async () => {
    const { organization, user } = await authenticateContext(app, prisma, usersRepository);

    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementationOnce(() =>
      chatEventsFor(
        JSON.stringify({
          steps: [
            {
              id: 'wait',
              name: 'Wait a bit',
              type: 'DELAY',
              config: { delayMs: 1000 },
            },
            {
              id: 'notify',
              name: 'Notify',
              type: 'NOTIFICATION',
              dependsOn: ['wait'],
              config: { channel: 'log', message: 'done waiting' },
            },
          ],
        }),
      ),
    );

    const result = (await withTenant(organization.id, user.id, () =>
      findTool('generate_workflow_from_description').execute(
        {
          name: `Generated workflow ${Date.now()}`,
          description: 'Wait a bit, then log that the wait finished.',
        },
        { conversationId: 'conversation-1', signal: new AbortController().signal },
      ),
    )) as { id: string; status: string; stepCount: number };

    expect(result.status).toBe('DRAFT');
    expect(result.stepCount).toBe(2);
    expect(aiRuntimeService.streamChat).toHaveBeenCalledTimes(1);

    const created = await withTenant(organization.id, user.id, () =>
      workflowService.getWorkflowOrThrow(result.id),
    );
    expect(created.name).toContain('Generated workflow');

    const versions = await withTenant(organization.id, user.id, () =>
      workflowService.listVersions(result.id),
    );
    const latest = versions[versions.length - 1];
    expect(latest?.definition.steps).toHaveLength(2);
  });

  it('retries once with the validation error fed back when the first generation attempt is invalid', async () => {
    const { organization, user } = await authenticateContext(app, prisma, usersRepository);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementationOnce(() =>
        // missing required config.delayMs — the validator should reject this
        chatEventsFor(
          JSON.stringify({ steps: [{ id: 'wait', name: 'Wait', type: 'DELAY', config: {} }] }),
        ),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            steps: [{ id: 'wait', name: 'Wait', type: 'DELAY', config: { delayMs: 500 } }],
          }),
        ),
      );

    const result = (await withTenant(organization.id, user.id, () =>
      findTool('generate_workflow_from_description').execute(
        { name: `Retried workflow ${Date.now()}`, description: 'Just wait half a second.' },
        { conversationId: 'conversation-1', signal: new AbortController().signal },
      ),
    )) as { id: string; status: string; stepCount: number };

    expect(result.status).toBe('DRAFT');
    expect(aiRuntimeService.streamChat).toHaveBeenCalledTimes(2);
  });

  it('rejects when both generation attempts are invalid, without creating a workflow', async () => {
    const { organization, user } = await authenticateContext(app, prisma, usersRepository);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementation(() =>
        chatEventsFor(
          JSON.stringify({ steps: [{ id: 'wait', name: 'Wait', type: 'DELAY', config: {} }] }),
        ),
      );

    await expect(
      withTenant(organization.id, user.id, () =>
        findTool('generate_workflow_from_description').execute(
          { name: `Invalid workflow ${Date.now()}`, description: 'This should fail twice.' },
          { conversationId: 'conversation-1', signal: new AbortController().signal },
        ),
      ),
    ).rejects.toThrow();

    expect(aiRuntimeService.streamChat).toHaveBeenCalledTimes(2);
  });
});
