import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformAlertEntity } from './entities/platform-alert.entity';
import {
  CreatePlatformAlertData,
  ListPlatformAlertsFilter,
  PlatformAlertRepository,
} from './platform-alert.repository';

@Injectable()
export class PlatformAlertService {
  constructor(private readonly repository: PlatformAlertRepository) {}

  create(data: CreatePlatformAlertData): Promise<PlatformAlertEntity> {
    return this.repository.create(data);
  }

  list(filter: ListPlatformAlertsFilter): Promise<PlatformAlertEntity[]> {
    return this.repository.findMany(filter);
  }

  async getOrThrow(id: string): Promise<PlatformAlertEntity> {
    const alert = await this.repository.findById(id);
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    return alert;
  }

  async acknowledge(id: string, acknowledgedById: string): Promise<PlatformAlertEntity> {
    await this.getOrThrow(id);
    return this.repository.acknowledge(id, acknowledgedById);
  }

  async resolve(id: string, resolvedById: string): Promise<PlatformAlertEntity> {
    await this.getOrThrow(id);
    return this.repository.resolve(id, resolvedById);
  }

  async delete(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.repository.delete(id);
  }
}
