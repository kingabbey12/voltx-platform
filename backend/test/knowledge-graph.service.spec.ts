import { KnowledgeGraphService } from '../src/modules/knowledge/graph/knowledge-graph.service';

function entityFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'entity-1',
    organizationId: 'org-1',
    type: 'PERSON',
    externalId: 'contact-1',
    label: 'Jane Doe',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('KnowledgeGraphService', () => {
  let repository: {
    upsertEntity: jest.Mock;
    createRelationship: jest.Mock;
    traverse: jest.Mock;
    findByExternalId: jest.Mock;
    countEntitiesForOrganization: jest.Mock;
    countRelationshipsForOrganization: jest.Mock;
  };
  let service: KnowledgeGraphService;

  beforeEach(() => {
    repository = {
      upsertEntity: jest.fn(),
      createRelationship: jest.fn(),
      traverse: jest.fn(),
      findByExternalId: jest.fn(),
      countEntitiesForOrganization: jest.fn(),
      countRelationshipsForOrganization: jest.fn(),
    };
    service = new KnowledgeGraphService(repository as never);
  });

  it('linkEntities upserts both entities before creating the edge between them', async () => {
    const fromEntity = entityFixture({ id: 'entity-from', type: 'PERSON', label: 'Jane Doe' });
    const toEntity = entityFixture({ id: 'entity-to', type: 'COMPANY', label: 'Acme Corp' });
    repository.upsertEntity.mockResolvedValueOnce(fromEntity).mockResolvedValueOnce(toEntity);

    await service.linkEntities({
      from: { type: 'PERSON', externalId: 'contact-1', label: 'Jane Doe' },
      to: { type: 'COMPANY', externalId: 'company-1', label: 'Acme Corp' },
      relationship: 'WORKS_AT',
    });

    expect(repository.upsertEntity).toHaveBeenNthCalledWith(1, {
      type: 'PERSON',
      externalId: 'contact-1',
      label: 'Jane Doe',
    });
    expect(repository.upsertEntity).toHaveBeenNthCalledWith(2, {
      type: 'COMPANY',
      externalId: 'company-1',
      label: 'Acme Corp',
    });
    expect(repository.createRelationship).toHaveBeenCalledWith({
      fromEntityId: 'entity-from',
      toEntityId: 'entity-to',
      type: 'WORKS_AT',
    });
  });

  it('describeRelatedContext returns an empty string when the record has no graph entity', async () => {
    repository.findByExternalId.mockResolvedValue(null);

    const description = await service.describeRelatedContext('PERSON', 'unknown-contact', 1);

    expect(description).toBe('');
    expect(repository.traverse).not.toHaveBeenCalled();
  });

  it('describeRelatedContext returns an empty string when there are no neighbors within maxHops', async () => {
    const entity = entityFixture();
    repository.findByExternalId.mockResolvedValue(entity);
    repository.traverse.mockResolvedValue([{ entity, depth: 0, viaRelationship: null }]);

    const description = await service.describeRelatedContext('PERSON', 'contact-1', 1);

    expect(description).toBe('');
  });

  it('describeRelatedContext summarizes discovered neighbors with their relationship type', async () => {
    const root = entityFixture();
    const company = entityFixture({ id: 'entity-2', type: 'COMPANY', label: 'Acme Corp' });
    repository.findByExternalId.mockResolvedValue(root);
    repository.traverse.mockResolvedValue([
      { entity: root, depth: 0, viaRelationship: null },
      { entity: company, depth: 1, viaRelationship: 'WORKS_AT' },
    ]);

    const description = await service.describeRelatedContext('PERSON', 'contact-1', 2);

    expect(description).toBe('WORKS_AT: Acme Corp (COMPANY)');
    expect(repository.traverse).toHaveBeenCalledWith('entity-1', 2);
  });

  it('stats aggregates entity and relationship counts', async () => {
    repository.countEntitiesForOrganization.mockResolvedValue(5);
    repository.countRelationshipsForOrganization.mockResolvedValue(9);

    const stats = await service.stats();

    expect(stats).toEqual({ entityCount: 5, relationshipCount: 9 });
  });
});
