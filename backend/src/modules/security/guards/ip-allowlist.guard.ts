import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { parseOrganizationSecurityPolicy } from '../../organization/utils/organization-security-policy.util';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { ipMatchesAllowlist } from '../utils/ip-match.util';

/**
 * Composes after UserContextGuard/ApiKeyGuard (needs `request.currentUser`
 * already resolved) — an empty `ipAllowlist` on the organization's security
 * policy means "no restriction" (the common case). Relies entirely on
 * Express's own `request.ip`, which only honors X-Forwarded-For up to
 * `TRUSTED_PROXY_COUNT` hops (see configure-app.ts's `app.set('trust
 * proxy', ...)`) — never parses that header itself, so it can't be spoofed
 * by a client sending an arbitrary X-Forwarded-For unless an operator
 * misconfigures the trusted-hop count.
 */
@Injectable()
export class IpAllowlistGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.currentUser) {
      throw new UnauthorizedException('Authentication principal is missing');
    }

    const organization = await this.prisma.system.organization.findUnique({
      where: { id: request.currentUser.organizationId },
      select: { settings: true },
    });
    const policy = parseOrganizationSecurityPolicy(organization?.settings);

    if (policy.ipAllowlist.length === 0) {
      return true;
    }

    const clientIp = request.ip;
    if (!clientIp || !ipMatchesAllowlist(clientIp, policy.ipAllowlist)) {
      throw new ForbiddenException("Your IP address is not on this organization's allowlist");
    }

    return true;
  }
}
