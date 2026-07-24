import { Prisma } from '@prisma/client';

export type AgentScheduleTriggerType = 'CRON' | 'EVENT';

export interface AgentScheduleEntity {
  id: string;
  organizationId: string;
  agentId: string;
  agentVersionId: string | null;
  triggerType: AgentScheduleTriggerType;
  cronExpression: string | null;
  eventName: string | null;
  input: Record<string, unknown>;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentScheduleRecord {
  id: string;
  organizationId: string;
  agentId: string;
  agentVersionId: string | null;
  triggerType: AgentScheduleTriggerType;
  cronExpression: string | null;
  eventName: string | null;
  input: Prisma.JsonValue;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAgentScheduleEntity(record: AgentScheduleRecord): AgentScheduleEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    agentId: record.agentId,
    agentVersionId: record.agentVersionId,
    triggerType: record.triggerType,
    cronExpression: record.cronExpression,
    eventName: record.eventName,
    input: toObject(record.input),
    enabled: record.enabled,
    nextRunAt: record.nextRunAt,
    lastRunAt: record.lastRunAt,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
