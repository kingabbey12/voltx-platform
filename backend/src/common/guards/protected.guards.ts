import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { UserContextGuard } from '../../modules/auth/guards/user-context.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

/**
 * Authenticated route guards. JwtAuthGuard validates Bearer access tokens;
 * UserContextGuard resolves organization membership and RBAC permissions;
 * TenantGuard enforces JWT-derived tenant isolation.
 */
export const AUTH_GUARDS = [JwtAuthGuard, UserContextGuard, TenantGuard] as const;

/**
 * Cross-organization Super Admin Billing Console routes. Deliberately
 * NOT AUTH_GUARDS + PlatformAdminGuard — UserContextGuard/TenantGuard
 * hard-require the caller's JWT org claim to match one specific
 * organization, which is wrong for "see every organization." Only
 * JwtAuthGuard (validates the bearer token, resolves
 * request.authPrincipal.userId) plus PlatformAdminGuard (checks that
 * user's isPlatformAdmin flag, unscoped by any single org) apply here.
 */
export const PLATFORM_ADMIN_GUARDS = [JwtAuthGuard, PlatformAdminGuard] as const;
