import { PII_REGISTRY } from '../src/modules/compliance/pii/pii-registry';
import { PiiRegistryService } from '../src/modules/compliance/pii/pii-registry.service';

type MockDelegate = {
  findMany: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
};

function makeMockClient(): {
  client: Record<string, MockDelegate>;
  delegates: Record<string, MockDelegate>;
} {
  const delegates: Record<string, MockDelegate> = {};
  const uniqueModels = new Set(PII_REGISTRY.map((entry) => entry.model));

  for (const model of uniqueModels) {
    delegates[model] = {
      findMany: jest.fn().mockResolvedValue([{ id: `${model}-row-1` }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
  }

  return { client: delegates, delegates };
}

describe('PiiRegistryService', () => {
  let service: PiiRegistryService;

  beforeEach(() => {
    service = new PiiRegistryService();
  });

  describe('exportForUser', () => {
    it("queries every model in the registry, scoped by organizationId and the model's userId field", async () => {
      const { client, delegates } = makeMockClient();

      const sections = await service.exportForUser(client as never, 'org-1', 'user-1');

      expect(sections).toHaveLength(PII_REGISTRY.length);

      for (const entry of PII_REGISTRY) {
        expect(delegates[entry.model].findMany).toHaveBeenCalledWith({
          where: { [entry.userIdField]: 'user-1', organizationId: 'org-1' },
        });
      }
    });

    it('includes rows from EXCLUDED-from-erasure models too (export is always complete)', async () => {
      const { client } = makeMockClient();
      const sections = await service.exportForUser(client as never, 'org-1', 'user-1');

      const auditLogSection = sections.find((section) => section.model === 'auditLog');
      expect(auditLogSection).toBeDefined();
      expect(auditLogSection?.rows).toHaveLength(1);
    });
  });

  describe('eraseForUser', () => {
    it('calls deleteMany for every DELETE-strategy model', async () => {
      const { client, delegates } = makeMockClient();
      const outcomes = await service.eraseForUser(client as never, 'org-1', 'user-1');

      const deleteEntries = PII_REGISTRY.filter((entry) => entry.erasure.kind === 'DELETE');
      for (const entry of deleteEntries) {
        expect(delegates[entry.model].deleteMany).toHaveBeenCalledWith({
          where: { [entry.userIdField]: 'user-1', organizationId: 'org-1' },
        });
      }

      const conversationOutcome = outcomes.find((outcome) => outcome.model === 'conversation');
      expect(conversationOutcome?.action).toBe('DELETE');
      expect(conversationOutcome?.affected).toBe(1);
    });

    it("calls updateMany with the registry's buildData() for ANONYMIZE-strategy models", async () => {
      const { client, delegates } = makeMockClient();
      await service.eraseForUser(client as never, 'org-1', 'user-1');

      const membershipEntry = PII_REGISTRY.find((entry) => entry.model === 'membership');
      expect(membershipEntry?.erasure.kind).toBe('ANONYMIZE');
      expect(delegates.membership.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', organizationId: 'org-1' },
        data: { status: 'INACTIVE' },
      });
    });

    it("never touches EXCLUDED models' data — no deleteMany/updateMany call at all", async () => {
      const { client, delegates } = makeMockClient();
      const outcomes = await service.eraseForUser(client as never, 'org-1', 'user-1');

      // "invitation" deliberately appears twice in the registry (once
      // EXCLUDED for invitedByUserId, once ANONYMIZE for acceptedByUserId)
      // — restrict this assertion to models that are EXCLUDED everywhere
      // they appear, so the shared-model case above isn't misread as a leak.
      const modelsWithAnyMutatingEntry = new Set(
        PII_REGISTRY.filter((entry) => entry.erasure.kind !== 'EXCLUDED').map(
          (entry) => entry.model,
        ),
      );
      const excludedEntries = PII_REGISTRY.filter(
        (entry) =>
          entry.erasure.kind === 'EXCLUDED' && !modelsWithAnyMutatingEntry.has(entry.model),
      );
      for (const entry of excludedEntries) {
        expect(delegates[entry.model].deleteMany).not.toHaveBeenCalled();
        expect(delegates[entry.model].updateMany).not.toHaveBeenCalled();
      }

      const auditLogOutcome = outcomes.find(
        (outcome) => outcome.model === 'auditLog' && outcome.label.includes('logged'),
      );
      expect(auditLogOutcome?.action).toBe('EXCLUDED');
      expect(auditLogOutcome?.affected).toBe(0);
      expect(auditLogOutcome?.reason).toBeTruthy();
    });

    it('produces exactly one outcome per registry entry', async () => {
      const { client } = makeMockClient();
      const outcomes = await service.eraseForUser(client as never, 'org-1', 'user-1');
      expect(outcomes).toHaveLength(PII_REGISTRY.length);
    });
  });
});

describe('PII_REGISTRY manifest', () => {
  it('documents a reason for every EXCLUDED erasure action', () => {
    for (const entry of PII_REGISTRY) {
      if (entry.erasure.kind === 'EXCLUDED') {
        expect(entry.erasure.reason.length).toBeGreaterThan(10);
      }
    }
  });

  it('is scoped entirely by organizationId (no entry claims otherwise)', () => {
    for (const entry of PII_REGISTRY) {
      expect(entry.organizationScoped).toBe(true);
    }
  });

  it('covers every comms/AI/attachment/audit model this phase was scoped to consider', () => {
    const models = PII_REGISTRY.map((entry) => `${entry.model}:${entry.userIdField}`);
    expect(models).toEqual(
      expect.arrayContaining([
        'membership:userId',
        'conversation:userId',
        'memory:userId',
        'aiUsageLog:userId',
        'notification:userId',
        'messageReaction:userId',
        'invitation:invitedByUserId',
        'invitation:acceptedByUserId',
        'auditLog:userId',
        'consentRecord:userId',
        'attachment:uploadedBy',
        'attachmentVersion:createdBy',
        'commsMessage:senderId',
        'commsNote:authorId',
        'commsParticipant:userId',
      ]),
    );
  });
});
