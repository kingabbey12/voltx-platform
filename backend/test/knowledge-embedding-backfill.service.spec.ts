import { ServiceUnavailableException } from '@nestjs/common';
import { KnowledgeEmbeddingBackfillService } from '../src/modules/knowledge/ingestion/knowledge-embedding-backfill.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

function configServiceStub() {
  return {
    get: jest.fn((_key: string, defaultValue: unknown) => defaultValue),
  } as never;
}

// eslint-disable-next-line require-yield, @typescript-eslint/require-await -- a yield-less async generator is exactly what's under test: reindexDocument's event stream drained straight to its return value.
async function* generatorReturning<R>(value: R): AsyncGenerator<never, R> {
  return value;
}

describe('KnowledgeEmbeddingBackfillService', () => {
  let documentRepository: { listEmbeddingsPendingSystem: jest.Mock };
  let ingestionService: { reindexDocument: jest.Mock };
  let modelRegistryService: { resolveProviderAndModel: jest.Mock };
  let prisma: { system: { membership: { findFirst: jest.Mock } } };
  // The real TenantContextService: the whole point is verifying reindex
  // runs inside a context the tenant-scoped repositories will accept.
  const tenantContextService = new TenantContextService();

  function buildService(): KnowledgeEmbeddingBackfillService {
    return new KnowledgeEmbeddingBackfillService(
      documentRepository as never,
      ingestionService as never,
      modelRegistryService as never,
      tenantContextService,
      prisma as never,
      configServiceStub(),
    );
  }

  beforeEach(() => {
    documentRepository = {
      listEmbeddingsPendingSystem: jest
        .fn()
        .mockResolvedValue([{ id: 'doc-1', organizationId: 'org-1' }]),
    };
    ingestionService = {
      reindexDocument: jest.fn().mockImplementation(() =>
        generatorReturning({
          documentId: 'doc-1',
          status: 'INDEXED',
          chunkCount: 2,
          embeddingsSkipped: false,
        }),
      ),
    };
    modelRegistryService = { resolveProviderAndModel: jest.fn().mockResolvedValue({}) };
    prisma = {
      system: {
        membership: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'membership-1', userId: 'user-1', organizationId: 'org-1' }),
        },
      },
    };
  });

  it('does nothing when there is no pending backlog', async () => {
    documentRepository.listEmbeddingsPendingSystem.mockResolvedValue([]);

    const result = await buildService().runOnce();

    expect(result).toEqual({ processed: 0, reembedded: 0 });
    expect(modelRegistryService.resolveProviderAndModel).not.toHaveBeenCalled();
    expect(ingestionService.reindexDocument).not.toHaveBeenCalled();
  });

  it('leaves the backlog untouched while no AI provider is available', async () => {
    modelRegistryService.resolveProviderAndModel.mockRejectedValue(
      new ServiceUnavailableException('No AI providers are enabled'),
    );

    const result = await buildService().runOnce();

    expect(result).toEqual({ processed: 0, reembedded: 0 });
    expect(ingestionService.reindexDocument).not.toHaveBeenCalled();
  });

  it('re-embeds pending documents inside a full tenant context once a provider is available', async () => {
    let observedContext: unknown;
    ingestionService.reindexDocument.mockImplementation(() => {
      observedContext = tenantContextService.getOrThrow();
      return generatorReturning({
        documentId: 'doc-1',
        status: 'INDEXED',
        chunkCount: 2,
        embeddingsSkipped: false,
      });
    });

    const result = await buildService().runOnce();

    expect(result).toEqual({ processed: 1, reembedded: 1 });
    expect(observedContext).toEqual(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        membershipId: 'membership-1',
      }),
    );
  });

  it('skips organizations with no active membership and keeps processing the batch', async () => {
    documentRepository.listEmbeddingsPendingSystem.mockResolvedValue([
      { id: 'doc-orphan', organizationId: 'org-dead' },
      { id: 'doc-2', organizationId: 'org-1' },
    ]);
    prisma.system.membership.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'membership-1', userId: 'user-1', organizationId: 'org-1' });

    const result = await buildService().runOnce();

    expect(result).toEqual({ processed: 2, reembedded: 1 });
    expect(ingestionService.reindexDocument).toHaveBeenCalledTimes(1);
    expect(ingestionService.reindexDocument).toHaveBeenCalledWith('doc-2');
  });

  it('continues past a document whose reindex throws', async () => {
    documentRepository.listEmbeddingsPendingSystem.mockResolvedValue([
      { id: 'doc-bad', organizationId: 'org-1' },
      { id: 'doc-good', organizationId: 'org-1' },
    ]);
    ingestionService.reindexDocument
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      .mockImplementationOnce(() =>
        generatorReturning({
          documentId: 'doc-good',
          status: 'INDEXED',
          chunkCount: 1,
          embeddingsSkipped: false,
        }),
      );

    const result = await buildService().runOnce();

    expect(result).toEqual({ processed: 2, reembedded: 1 });
  });
});
