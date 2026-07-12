import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ScimAuthenticatedRequest } from '../interfaces/scim-request.interface';
import { ScimTokenRepository } from '../scim-token.repository';
import { hashScimToken } from '../utils/scim-token.util';

/**
 * Authenticates inbound SCIM requests by a bearer token unrelated to the
 * normal JWT stack (AUTH_GUARDS) — SCIM clients (Okta/Entra/etc.) call
 * these endpoints with a long-lived static bearer token, never a JWT.
 * Resolves organizationId purely from the token itself (never trusts a
 * client-supplied org id anywhere), mirroring RefreshTokenRepository's
 * hash-and-compare convention.
 */
@Injectable()
export class ScimTokenGuard implements CanActivate {
  constructor(private readonly scimTokenRepository: ScimTokenRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScimAuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing SCIM bearer token');
    }
    const rawToken = authHeader.slice('Bearer '.length).trim();
    if (!rawToken) {
      throw new UnauthorizedException('Missing SCIM bearer token');
    }

    const token = await this.scimTokenRepository.findActiveByTokenHash(hashScimToken(rawToken));
    if (!token) {
      throw new UnauthorizedException('Invalid or revoked SCIM token');
    }
    if (token.expiresAt && token.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('SCIM token has expired');
    }

    request.scimContext = { organizationId: token.organizationId, scimTokenId: token.id };
    await this.scimTokenRepository.touchLastUsed(token.id);

    return true;
  }
}
