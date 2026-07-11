import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EncryptionService } from '../integrations/security/encryption.service';
import { WorkflowSecretEntity } from './entities/workflow-secret.entity';
import { WorkflowSecretRepository } from './workflow-secret.repository';

export interface CreateWorkflowSecretRequest {
  key: string;
  value: string;
  description?: string;
  createdBy: string;
}

/**
 * Values are always encrypted via the shared EncryptionService (the same
 * one every OAuth credential in this codebase uses) and are never
 * returned by any read method — WorkflowSecretEntity has no value field
 * at all, only key/metadata. resolveDecryptedValue is the one place a
 * value is ever decrypted, and it's for internal engine use only, never
 * exposed through the controller.
 */
@Injectable()
export class WorkflowSecretService {
  constructor(
    private readonly workflowSecretRepository: WorkflowSecretRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(request: CreateWorkflowSecretRequest): Promise<WorkflowSecretEntity> {
    const existing = await this.workflowSecretRepository.findByKey(request.key);
    if (existing) {
      throw new ConflictException(`A secret with key "${request.key}" already exists`);
    }

    const { encryptedValue: _encryptedValue, ...entity } =
      await this.workflowSecretRepository.create({
        key: request.key,
        encryptedValue: this.encryptionService.encrypt(request.value),
        description: request.description,
        createdBy: request.createdBy,
      });
    return entity;
  }

  async list(): Promise<WorkflowSecretEntity[]> {
    return this.workflowSecretRepository.listAll();
  }

  async rotate(id: string, newValue: string): Promise<WorkflowSecretEntity> {
    const rotated = await this.workflowSecretRepository.rotate(
      id,
      this.encryptionService.encrypt(newValue),
    );
    if (!rotated) {
      throw new NotFoundException('Workflow secret not found');
    }
    const { encryptedValue: _encryptedValue, ...entity } = rotated;
    return entity;
  }

  async remove(id: string): Promise<WorkflowSecretEntity> {
    const removed = await this.workflowSecretRepository.remove(id);
    if (!removed) {
      throw new NotFoundException('Workflow secret not found');
    }
    const { encryptedValue: _encryptedValue, ...entity } = removed;
    return entity;
  }

  /** Internal engine use only (e.g. a future TOOL/API step referencing {{secrets.x}}) — never exposed via the controller. */
  async resolveDecryptedValue(key: string): Promise<string | null> {
    const secret = await this.workflowSecretRepository.findByKey(key);
    if (!secret) {
      return null;
    }
    await this.workflowSecretRepository.markUsed(secret.id);
    return this.encryptionService.decrypt(secret.encryptedValue);
  }
}
