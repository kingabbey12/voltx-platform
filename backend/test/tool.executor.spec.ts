import { Test, TestingModule } from '@nestjs/testing';
import { ToolExecutor } from '../src/modules/ai/tools/tool.executor';
import { AI_TOOLS, AITool, ToolExecutionError } from '../src/modules/ai/tools/tool.interface';
import { ToolRegistry } from '../src/modules/ai/tools/tool.registry';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  beforeEach(async () => {
    const retryingTool: AITool = {
      name: 'retrying_tool',
      description: 'Retries once before succeeding',
      defaultRetries: 1,
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: jest
        .fn()
        .mockRejectedValueOnce(
          new ToolExecutionError('Temporary failure', 'temporary_failure', true),
        )
        .mockResolvedValueOnce({ ok: true }),
    };

    const timeoutTool: AITool = {
      name: 'timeout_tool',
      description: 'Respects abort signal',
      defaultTimeoutMs: 5,
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: jest.fn(async (_input, context) => {
        await new Promise((resolve, reject) => {
          context.signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
          setTimeout(resolve, 50);
        });

        return { ok: true };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRegistry,
        ToolExecutor,
        {
          provide: AI_TOOLS,
          useValue: [retryingTool, timeoutTool],
        },
      ],
    }).compile();

    executor = module.get(ToolExecutor);
  });

  it('retries retryable tool failures', async () => {
    const result = await executor.execute({
      toolName: 'retrying_tool',
      input: {},
      conversationId: 'conversation-1',
    });

    expect(result.output).toEqual({ ok: true });
    expect(result.attempts).toBe(2);
  });

  it('fails with a timeout error when the tool exceeds timeout', async () => {
    await expect(
      executor.execute({
        toolName: 'timeout_tool',
        input: {},
        conversationId: 'conversation-1',
      }),
    ).rejects.toMatchObject({
      code: 'tool_timeout',
    });
  });
});
