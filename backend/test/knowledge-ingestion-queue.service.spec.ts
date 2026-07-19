import { Queue } from 'bullmq';
import { KnowledgeIngestionQueueService } from '../src/modules/knowledge/ingestion/knowledge-ingestion-queue.service';
import { KnowledgeIngestionJobEntity } from '../src/modules/knowledge/entities/knowledge-ingestion-job.entity';

function jobFixture(
  overrides: Partial<KnowledgeIngestionJobEntity> = {},
): KnowledgeIngestionJobEntity {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    sourceId: 'source-1',
    documentId: null,
    requestedByUserId: 'user-1',
    requestedByMembershipId: 'membership-1',
    status: 'QUEUED',
    progressPercent: 5,
    attemptsMade: 0,
    maxAttempts: 5,
    payload: {
      sourceId: 'source-1',
      title: 'Doc',
      contentType: 'text/plain',
      text: 'hello',
    },
    resumeFromJobId: null,
    cancellationRequestedAt: null,
    startedAt: null,
    completedAt: null,
    lastError: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('KnowledgeIngestionQueueService', () => {
  let queue: Pick<Queue, 'add' | 'getJob'>;
  let knowledgeService: {
    getSourceOrThrow: jest.Mock;
    ingestDocument: jest.Mock;
    processQueuedIngestionJob: jest.Mock;
  };
  let jobRepository: {
    createQueued: jest.Mock;
    findById: jest.Mock;
    updateSystem: jest.Mock;
    markCancellationRequested: jest.Mock;
  };
  let runtimeService: { cancel: jest.Mock };

  function buildService(withQueue = true): KnowledgeIngestionQueueService {
    return new KnowledgeIngestionQueueService(
      withQueue ? (queue as Queue) : null,
      knowledgeService as never,
      jobRepository as never,
      runtimeService as never,
    );
  }

  beforeEach(() => {
    queue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };
    knowledgeService = {
      getSourceOrThrow: jest.fn().mockResolvedValue(undefined),
      ingestDocument: jest.fn().mockResolvedValue({
        documentId: 'doc-1',
        status: 'INDEXED',
        chunkCount: 3,
      }),
      processQueuedIngestionJob: jest.fn().mockResolvedValue(undefined),
    };
    jobRepository = {
      createQueued: jest.fn().mockResolvedValue(jobFixture()),
      findById: jest.fn().mockResolvedValue(jobFixture()),
      updateSystem: jest.fn().mockResolvedValue(undefined),
      markCancellationRequested: jest.fn().mockResolvedValue(jobFixture()),
    };
    runtimeService = {
      cancel: jest.fn(),
    };
  });

  it('enqueues ingestion job when queue is configured', async () => {
    const service = buildService();

    const result = await service.enqueueIngestion({
      sourceId: 'source-1',
      title: 'Doc',
      contentType: 'text/plain',
      text: 'hello',
    });

    expect(knowledgeService.getSourceOrThrow).toHaveBeenCalledWith('source-1');
    expect(jobRepository.createQueued).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'source-1' }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'ingest_document',
      { trackingJobId: 'job-1', organizationId: 'org-1' },
      expect.objectContaining({ jobId: 'knowledge-job-1', attempts: 5 }),
    );
    expect(result.id).toBe('job-1');
  });

  it('falls back to synchronous ingestion when queue is disabled', async () => {
    const service = buildService(false);

    const result = await service.enqueueIngestion({
      sourceId: 'source-1',
      title: 'Doc',
      contentType: 'text/plain',
      text: 'hello',
    });

    expect(knowledgeService.ingestDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'source-1', title: 'Doc' }),
    );
    expect(jobRepository.updateSystem).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'READY', documentId: 'doc-1', attemptsMade: 1 }),
    );
    expect(result.id).toBe('job-1');
  });

  it('cancels a waiting queue job immediately', async () => {
    const waitingJob = {
      isWaiting: jest.fn().mockResolvedValue(true),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    (queue.getJob as jest.Mock).mockResolvedValue(waitingJob);

    const service = buildService();
    await service.requestCancellation('job-1');

    expect(waitingJob.remove).toHaveBeenCalled();
    expect(jobRepository.updateSystem).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'CANCELLED' }),
    );
    expect(runtimeService.cancel).not.toHaveBeenCalled();
  });

  it('requests runtime cancellation for running queue jobs', async () => {
    const activeJob = {
      isWaiting: jest.fn().mockResolvedValue(false),
      remove: jest.fn(),
    };
    (queue.getJob as jest.Mock).mockResolvedValue(activeJob);

    const service = buildService();
    await service.requestCancellation('job-1');

    expect(runtimeService.cancel).toHaveBeenCalledWith('job-1');
    expect(jobRepository.updateSystem).not.toHaveBeenCalled();
  });

  it('creates a resumed job and re-enqueues when previous job is failed', async () => {
    jobRepository.findById
      .mockResolvedValueOnce(jobFixture({ id: 'job-old', status: 'FAILED' }))
      .mockResolvedValueOnce(jobFixture({ id: 'job-2', status: 'QUEUED' }));
    jobRepository.createQueued.mockResolvedValue(
      jobFixture({ id: 'job-2', status: 'QUEUED', resumeFromJobId: 'job-old' }),
    );

    const service = buildService();
    const resumed = await service.resume('job-old');

    expect(jobRepository.createQueued).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'source-1', resumeFromJobId: 'job-old' }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'ingest_document',
      { trackingJobId: 'job-2', organizationId: 'org-1' },
      expect.objectContaining({ jobId: 'knowledge-job-2', attempts: 5 }),
    );
    expect(resumed?.id).toBe('job-2');
  });

  it('returns original job on resume when status is not terminal', async () => {
    jobRepository.findById.mockResolvedValue(jobFixture({ status: 'READY' }));

    const service = buildService();
    const result = await service.resume('job-1');

    expect(jobRepository.createQueued).not.toHaveBeenCalled();
    expect(result?.status).toBe('READY');
  });
});
