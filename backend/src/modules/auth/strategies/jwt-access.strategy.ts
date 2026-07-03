import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_ACCESS_STRATEGY } from '../constants/auth.constants';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, JWT_ACCESS_STRATEGY) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  validate(payload: JwtAccessPayload): { userId: string; organizationId?: string } {
    if (!payload || payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }

    if (typeof payload.org !== 'string') {
      throw new UnauthorizedException('Access token is missing organization context');
    }

    return {
      userId: payload.sub,
      organizationId: payload.org,
    };
  }
}
