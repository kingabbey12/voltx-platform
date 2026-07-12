import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupportNoteEntity } from '../src/modules/platform/support-notes/entities/support-note.entity';
import { SupportNoteRepository } from '../src/modules/platform/support-notes/support-note.repository';
import { SupportNoteService } from '../src/modules/platform/support-notes/support-note.service';

function makeNote(overrides: Partial<SupportNoteEntity> = {}): SupportNoteEntity {
  return {
    id: 'note-1',
    organizationId: 'org-1',
    authorId: 'admin-1',
    note: 'Customer reported a billing discrepancy.',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SupportNoteService', () => {
  let service: SupportNoteService;
  let repository: jest.Mocked<SupportNoteRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportNoteService,
        {
          provide: SupportNoteRepository,
          useValue: {
            create: jest.fn(),
            listByOrganization: jest.fn(),
            findById: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SupportNoteService);
    repository = module.get(SupportNoteRepository);
  });

  it('creates a note for an organization', async () => {
    repository.create.mockResolvedValue(makeNote());
    const result = await service.create(
      'org-1',
      'admin-1',
      'Customer reported a billing discrepancy.',
    );
    expect(result.id).toBe('note-1');
    expect(repository.create).toHaveBeenCalledWith({
      organizationId: 'org-1',
      authorId: 'admin-1',
      note: 'Customer reported a billing discrepancy.',
    });
  });

  it('lists notes for an organization', async () => {
    repository.listByOrganization.mockResolvedValue([makeNote()]);
    const result = await service.list('org-1');
    expect(result).toHaveLength(1);
  });

  it('throws NotFoundException when deleting an unknown note', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.delete('not-real')).rejects.toThrow(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes an existing note', async () => {
    repository.findById.mockResolvedValue(makeNote());
    await service.delete('note-1');
    expect(repository.delete).toHaveBeenCalledWith('note-1');
  });
});
