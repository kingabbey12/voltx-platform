import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { SupportSessionStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_ACCESS_STRATEGY } from '../constants/auth.constants';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';
import { SupportSessionRepository } from '../support-session.repository';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, JWT_ACCESS_STRATEGY) {
  constructor(
    configService: ConfigService,
    private readonly supportSessionRepository: SupportSessionRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(
    payload: JwtAccessPayload,
  ): Promise<{ userId: string; organizationId?: string; supportSessionId?: string }> {
    if (!payload || payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }

    if (typeof payload.org !== 'string') {
      throw new UnauthorizedException('Access token is missing organization context');
    }

    if (payload.supportSessionId) {
      // Impersonation tokens are otherwise indistinguishable from a normal
      // access token by signature/expiry alone — this is what makes
      // "end session early" (or the session simply expiring server-side)
      // instantly reject the token, without a separate blocklist.
      const session = await this.supportSessionRepository.findById(payload.supportSessionId);
      if (
        !session ||
        session.status !== SupportSessionStatus.ACTIVE ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException('Support session is no longer active');
      }
    }

    return {
      userId: payload.sub,
      organizationId: payload.org,
      supportSessionId: payload.supportSessionId,
    };
  }
}
