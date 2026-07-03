import { JwtAuthGuard } from './jwt-auth.guard';
import { UserContextGuard } from './user-context.guard';

/**
 * Authenticated route guards. JwtAuthGuard validates Bearer access tokens;
 * UserContextGuard resolves organization membership and RBAC permissions.
 */
export const AUTH_GUARDS = [JwtAuthGuard, UserContextGuard] as const;
