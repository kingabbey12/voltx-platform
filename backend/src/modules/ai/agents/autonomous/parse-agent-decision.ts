import { AgentDecision, DelegationTarget } from './agent-decision.types';
import { extractJsonObject } from './extract-json-object';

/**
 * Parses the model's per-iteration decision out of its raw text output.
 *
 * Models do not always perfectly follow formatting instructions, so this
 * never throws: any output that isn't a well-formed tool_call/delegate
 * decision is treated as a final_answer using whatever text the model
 * produced. That guarantees the loop always makes forward progress — a
 * malformed decision ends the run with an answer instead of crashing it.
 */
export function parseAgentDecision(rawText: string): AgentDecision {
  const trimmed = rawText.trim();
  const parsed = extractJsonObject(trimmed);
  const thought = typeof parsed?.thought === 'string' ? parsed.thought : '';

  if (
    parsed &&
    parsed.action === 'tool_call' &&
    typeof parsed.toolName === 'string' &&
    parsed.toolName.trim().length > 0
  ) {
    return {
      kind: 'tool_call',
      thought,
      toolName: parsed.toolName.trim(),
      input: isPlainObject(parsed.input) ? parsed.input : {},
    };
  }

  if (
    parsed &&
    parsed.action === 'delegate' &&
    typeof parsed.agentName === 'string' &&
    parsed.agentName.trim().length > 0 &&
    typeof parsed.objective === 'string' &&
    parsed.objective.trim().length > 0
  ) {
    return {
      kind: 'delegate',
      thought,
      agentName: parsed.agentName.trim(),
      objective: parsed.objective.trim(),
    };
  }

  if (parsed && parsed.action === 'delegate_parallel' && Array.isArray(parsed.delegations)) {
    const delegations = parseDelegationTargets(parsed.delegations);
    if (delegations.length > 0) {
      return { kind: 'delegate_parallel', thought, delegations };
    }
  }

  if (parsed && parsed.action === 'final_answer' && typeof parsed.content === 'string') {
    return {
      kind: 'final_answer',
      thought,
      content: parsed.content,
    };
  }

  return {
    kind: 'final_answer',
    thought: '',
    content: trimmed.length > 0 ? trimmed : 'No response was generated.',
  };
}

function parseDelegationTargets(value: unknown[]): DelegationTarget[] {
  return value
    .filter(isPlainObject)
    .filter(
      (item): item is { agentName: string; objective: string } =>
        typeof item.agentName === 'string' &&
        item.agentName.trim().length > 0 &&
        typeof item.objective === 'string' &&
        item.objective.trim().length > 0,
    )
    .map((item) => ({ agentName: item.agentName.trim(), objective: item.objective.trim() }));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
