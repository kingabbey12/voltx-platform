import { AGENT_TASK_QUEUE } from '../../modules/ai/agents/jobs/agent-task-queue.constants';
import { ATTACHMENT_PROCESS_QUEUE } from '../../modules/attachments/processing/attachment-processing.constants';
import { STRIPE_WEBHOOK_QUEUE } from '../../modules/billing/jobs/stripe-webhook-queue.constants';
import { AI_PROCESS_QUEUE } from '../../modules/communications/jobs/communications-jobs.constants';
import { KNOWLEDGE_INGESTION_QUEUE } from '../../modules/knowledge/ingestion/knowledge-ingestion-queue.constants';
import { WEBHOOK_DELIVERY_QUEUE } from '../../modules/webhooks/jobs/webhook-delivery-queue.constants';
import { WORKFLOW_RUN_QUEUE } from '../../modules/workflows/jobs/workflow-run-queue.constants';

export const REDIS_QUEUE_NAMES = [
  AGENT_TASK_QUEUE,
  ATTACHMENT_PROCESS_QUEUE,
  STRIPE_WEBHOOK_QUEUE,
  AI_PROCESS_QUEUE,
  KNOWLEDGE_INGESTION_QUEUE,
  WEBHOOK_DELIVERY_QUEUE,
  WORKFLOW_RUN_QUEUE,
] as const;

export type RedisQueueName = (typeof REDIS_QUEUE_NAMES)[number];

/**
 * One shared command client plus one unavoidable duplicated blocking
 * connection per BullMQ Worker. There are no QueueEvents, per-queue producer,
 * cache, health, metrics, embedding-cache, or scheduler-lock clients.
 */
export const EXPECTED_IDLE_REDIS_CONNECTIONS = 1 + REDIS_QUEUE_NAMES.length;
