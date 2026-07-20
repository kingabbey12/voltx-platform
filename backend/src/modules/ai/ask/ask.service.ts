import { Injectable } from '@nestjs/common';
import { AgentService } from '../agents/agent.service';
import { RunAutonomousAgentDto } from '../agents/dto/autonomous-agent.dto';
import { isAbortError } from '../streaming/drain-generator';
import { GroundedRecordRef } from '../tools/tool-result.types';
import { ASK_RESPONSE_CONTRACT } from './ask-response-contract';
import { parseAndGroundAskOutput } from './ask-response.parser';
import { AskStreamEvent } from './ask.types';
import { SentenceChunker } from './sentence-chunker';

export interface AskStreamInput {
  agentId: string;
  conversationId: string;
  prompt: string;
  workspaceContext?: string[];
}

/**
 * Ask is an agent configuration plus a rendering contract (docs/design/
 * ASK.md §9): this service adds no second runtime. It appends the response
 * contract to the turn, delegates to the existing autonomous loop, and
 * transforms its event stream at the edge — token deltas become whole
 * sentences, tool starts become doing-lines in plain words, approvals become
 * held-work events, and the final output is parsed and ground-checked into
 * the structured response the Today surface consumes.
 *
 * Tenant isolation and RBAC are inherited, not re-implemented: the loop runs
 * under the caller's tenant context and granted permissions, and every tool
 * it can reach is already permission-filtered there.
 */
@Injectable()
export class AskService {
  constructor(private readonly agentService: AgentService) {}

  async *stream(
    input: AskStreamInput,
    grantedPermissions: string[],
    signal?: AbortSignal,
  ): AsyncGenerator<AskStreamEvent> {
    const dto = new RunAutonomousAgentDto();
    dto.conversationId = input.conversationId;
    dto.objective = `${input.prompt.trim()}\n\n${ASK_RESPONSE_CONTRACT}`;
    dto.workspaceContext = input.workspaceContext;

    const chunker = new SentenceChunker();
    const groundedRecords: GroundedRecordRef[] = [];
    const heldApprovalIds: string[] = [];
    let outputText = '';

    const source = this.agentService.runAutonomousAgentStream(
      input.agentId,
      dto,
      grantedPermissions,
      signal,
    );

    try {
      for await (const event of source) {
        switch (event.type) {
          case 'tool_call_start':
            yield { type: 'doing', label: describeToolWork(event.toolName) };
            break;

          case 'tool_call_result':
            if (event.grounding) {
              groundedRecords.push(...event.grounding.records);
            }
            break;

          case 'run_paused_for_approval':
            heldApprovalIds.push(event.approvalId);
            yield { type: 'held', approvalId: event.approvalId, toolName: event.toolName };
            break;

          case 'provider_event': {
            const providerEvent = event.event;
            if (providerEvent.type === 'content_delta') {
              outputText += providerEvent.delta;
              for (const sentence of chunker.push(providerEvent.delta)) {
                yield { type: 'sentence', text: sentence };
              }
            } else if (
              providerEvent.type === 'message_end' &&
              providerEvent.outputText &&
              providerEvent.outputText.trim().length > 0
            ) {
              outputText = providerEvent.outputText;
            }
            break;
          }

          default:
            break;
        }
      }
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        yield { type: 'stopped' };
        return;
      }
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'The answer could not be completed',
      };
      return;
    }

    for (const sentence of chunker.flush()) {
      yield { type: 'sentence', text: sentence };
    }

    const { structured } = parseAndGroundAskOutput(outputText, groundedRecords, heldApprovalIds);
    yield { type: 'response', response: structured };
  }
}

/** Doing-lines name the actual work, in words — never a spinner. */
function describeToolWork(toolName: string): string {
  const words = toolName.replace(/[_-]+/g, ' ').toLowerCase();
  const [first = '', ...rest] = words.split(' ');
  const gerunds: Record<string, string> = {
    search: 'Searching',
    get: 'Reading',
    list: 'Reading',
    read: 'Reading',
    find: 'Finding',
    create: 'Drafting',
    update: 'Updating',
    send: 'Preparing',
  };
  const verb = gerunds[first] ?? 'Reading';
  const subject = rest.join(' ') || 'the records';
  return `${verb} ${subject}…`;
}
