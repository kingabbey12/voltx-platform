import { CompanyService } from '../src/modules/company/company.service';

describe('CompanyService', () => {
  it('keeps company home available when one independent section fails', async () => {
    const organizationService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'organization-1',
        name: 'Voltx Test',
        slug: 'voltx-test',
        industry: null,
        website: null,
        status: 'ACTIVE',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-02T00:00:00.000Z'),
      }),
    };
    const usersService = {
      findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const activitiesService = {
      findAll: jest.fn().mockRejectedValue(new Error('activities unavailable')),
    };

    const service = new CompanyService(
      organizationService as never,
      usersService as never,
      {} as never,
      {} as never,
      activitiesService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.getHome('organization-1', [
      'organization.read',
      'user.read',
      'sales.activity.read',
    ]);

    expect(result.organization.name).toBe('Voltx Test');
    expect(result.people).toMatchObject({ available: true, total: 0, items: [] });
    expect(result.events).toEqual({
      available: false,
      reason: 'This section is temporarily unavailable.',
      total: 0,
      items: [],
    });
    expect(result.documents.available).toBe(false);
    expect(result.conversations.available).toBe(false);
    expect(result.promises.available).toBe(false);
  });
});
