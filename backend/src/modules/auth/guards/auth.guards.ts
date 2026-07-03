import { DevelopmentAuthGuard } from './development-auth.guard';
import { UserContextGuard } from './user-context.guard';

/**
 * Authenticated route guards. Swap DevelopmentAuthGuard with JwtAuthGuard here
 * when JWT authentication is enabled — controllers and services stay unchanged.
 */
export const AUTH_GUARDS = [DevelopmentAuthGuard, UserContextGuard] as const;
