import { SeatAssignmentService } from '../src/modules/billing/seat-assignment.service';
import { SeatAssignmentRepository } from '../src/modules/billing/seat-assignment.repository';
import { SubscriptionService } from '../src/modules/billing/subscription.service';

describe('SeatAssignmentService', () => {
  let seatAssignmentRepository: jest.Mocked<SeatAssignmentRepository>;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let service: SeatAssignmentService;

  beforeEach(() => {
    seatAssignmentRepository = {
      findActiveByMembershipId: jest.fn(),
      countActive: jest.fn(),
      countActiveForCurrentOrganization: jest.fn(),
      assign: jest.fn(),
      release: jest.fn(),
      listActiveForOrganization: jest.fn(),
    } as never;
    subscriptionService = {
      getCurrentForOrganizationOrThrow: jest.fn(),
    } as never;
    service = new SeatAssignmentService(seatAssignmentRepository, subscriptionService);
  });

  describe('getAvailability', () => {
    it('reports capacity when used seats are below the plan limit', async () => {
      subscriptionService.getCurrentForOrganizationOrThrow.mockResolvedValue({
        id: 'sub-1',
        seats: 5,
      } as never);
      seatAssignmentRepository.countActive.mockResolvedValue(3);

      const result = await service.getAvailability('org-1');

      expect(result).toEqual({ used: 3, limit: 5, available: 2, hasCapacity: true });
    });

    it('reports no capacity when used seats meet the plan limit', async () => {
      subscriptionService.getCurrentForOrganizationOrThrow.mockResolvedValue({
        id: 'sub-1',
        seats: 5,
      } as never);
      seatAssignmentRepository.countActive.mockResolvedValue(5);

      const result = await service.getAvailability('org-1');

      expect(result).toEqual({ used: 5, limit: 5, available: 0, hasCapacity: false });
    });
  });

  describe('assignSeat', () => {
    it('returns the existing active assignment instead of creating a duplicate', async () => {
      const existing = { id: 'seat-1', membershipId: 'membership-1' } as never;
      seatAssignmentRepository.findActiveByMembershipId.mockResolvedValue(existing);

      const result = await service.assignSeat('org-1', 'membership-1');

      expect(result).toBe(existing);
      expect(subscriptionService.getCurrentForOrganizationOrThrow).not.toHaveBeenCalled();
      expect(seatAssignmentRepository.assign).not.toHaveBeenCalled();
    });

    it('assigns a new seat against the org’s current subscription when none exists yet', async () => {
      seatAssignmentRepository.findActiveByMembershipId.mockResolvedValue(null);
      subscriptionService.getCurrentForOrganizationOrThrow.mockResolvedValue({
        id: 'sub-1',
      } as never);
      const created = { id: 'seat-2', membershipId: 'membership-2' } as never;
      seatAssignmentRepository.assign.mockResolvedValue(created);

      const result = await service.assignSeat('org-1', 'membership-2');

      expect(seatAssignmentRepository.assign).toHaveBeenCalledWith(
        'org-1',
        'sub-1',
        'membership-2',
      );
      expect(result).toBe(created);
    });
  });

  describe('releaseSeat', () => {
    it('returns null when the membership has no active seat', async () => {
      seatAssignmentRepository.findActiveByMembershipId.mockResolvedValue(null);

      const result = await service.releaseSeat('membership-1');

      expect(result).toBeNull();
      expect(seatAssignmentRepository.release).not.toHaveBeenCalled();
    });

    it('releases the active seat', async () => {
      seatAssignmentRepository.findActiveByMembershipId.mockResolvedValue({
        id: 'seat-1',
      } as never);
      const released = { id: 'seat-1', releasedAt: new Date() } as never;
      seatAssignmentRepository.release.mockResolvedValue(released);

      const result = await service.releaseSeat('membership-1');

      expect(seatAssignmentRepository.release).toHaveBeenCalledWith('seat-1');
      expect(result).toBe(released);
    });
  });
});
