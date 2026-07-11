import { Injectable } from '@nestjs/common';
import { SeatAssignmentRepository } from './seat-assignment.repository';
import { SeatAssignmentEntity } from './entities/seat-assignment.entity';
import { SubscriptionService } from './subscription.service';

export interface SeatAvailability {
  used: number;
  limit: number;
  available: number;
  hasCapacity: boolean;
}

@Injectable()
export class SeatAssignmentService {
  constructor(
    private readonly seatAssignmentRepository: SeatAssignmentRepository,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async getAvailability(organizationId: string): Promise<SeatAvailability> {
    const subscription =
      await this.subscriptionService.getCurrentForOrganizationOrThrow(organizationId);
    const used = await this.seatAssignmentRepository.countActive(subscription.id);
    const limit = subscription.seats;
    return { used, limit, available: Math.max(0, limit - used), hasCapacity: used < limit };
  }

  async assignSeat(organizationId: string, membershipId: string): Promise<SeatAssignmentEntity> {
    const existing = await this.seatAssignmentRepository.findActiveByMembershipId(membershipId);
    if (existing) {
      return existing;
    }
    const subscription =
      await this.subscriptionService.getCurrentForOrganizationOrThrow(organizationId);
    return this.seatAssignmentRepository.assign(organizationId, subscription.id, membershipId);
  }

  async releaseSeat(membershipId: string): Promise<SeatAssignmentEntity | null> {
    const existing = await this.seatAssignmentRepository.findActiveByMembershipId(membershipId);
    if (!existing) {
      return null;
    }
    return this.seatAssignmentRepository.release(existing.id);
  }

  async listActiveForOrganization(organizationId: string): Promise<SeatAssignmentEntity[]> {
    return this.seatAssignmentRepository.listActiveForOrganization(organizationId);
  }
}
