import { SetMetadata } from '@nestjs/common';
import { REQUIRE_FEATURE_METADATA_KEY } from '../constants/require-feature-metadata.constants';

export interface RequireFeatureOptions {
  featureKey: string;
  quantity: number;
}

/**
 * Composes with FeatureGateGuard (added to a controller's @UseGuards
 * alongside AUTH_GUARDS/PermissionGuard) to gate an endpoint behind the
 * organization's current plan/usage — `featureKey: 'seats'` is handled
 * specially (checked against Subscription.seats/SeatAssignment, not
 * UsageRecord); every other key is checked against the plan's
 * FeatureLimit and the org's current-period UsageRecord total.
 */
export const RequireFeature = (featureKey: string, quantity = 1) =>
  SetMetadata(REQUIRE_FEATURE_METADATA_KEY, {
    featureKey,
    quantity,
  } satisfies RequireFeatureOptions);
