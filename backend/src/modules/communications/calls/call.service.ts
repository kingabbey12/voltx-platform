import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { CallRepository } from './call.repository';
import { CommsCallEntity, CommsCallRecordingEntity } from './entities/call.entity';

@Injectable()
export class CallService {
  constructor(
    private readonly callRepository: CallRepository,
    private readonly auditService: AuditService,
  ) {}

  async listCalls(params: { page: number; limit: number }) {
    return this.callRepository.findAll(params);
  }

  async getCallOrThrow(id: string): Promise<CommsCallEntity> {
    const call = await this.callRepository.findById(id);
    if (!call) {
      throw new NotFoundException(`Call "${id}" not found`);
    }
    return call;
  }

  async getRecording(callId: string): Promise<CommsCallRecordingEntity | null> {
    await this.getCallOrThrow(callId);
    return this.callRepository.findRecordingByCallId(callId);
  }

  async updateNotes(id: string, notes: string): Promise<CommsCallEntity> {
    await this.getCallOrThrow(id);
    const updated = await this.callRepository.updateUnscoped(id, { notes });
    await this.auditService.record({
      action: 'communications.call.notes_updated',
      resource: 'comms_call',
      resourceId: id,
      metadata: {},
    });
    return updated;
  }
}
