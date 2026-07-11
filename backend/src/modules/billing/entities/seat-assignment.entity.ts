export interface SeatAssignmentEntity {
  id: string;
  organizationId: string;
  subscriptionId: string;
  membershipId: string;
  assignedAt: Date;
  releasedAt: Date | null;
}
