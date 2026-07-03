import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { UserContextGuard } from '../../modules/auth/guards/user-context.guard';
import { TenantGuard } from '../tenant/tenant.guard';

/**
 * Authenticated route guards. JwtAuthGuard validates Bearer access tokens;
 * UserContextGuard resolves organization membership and RBAC permissions;
 * TenantGuard enforces JWT-derived tenant isolation.
 */
export const AUTH_GUARDS = [JwtAuthGuard, UserContextGuard, TenantGuard] as const;
