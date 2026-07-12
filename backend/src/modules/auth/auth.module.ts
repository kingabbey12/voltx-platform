import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { OrganizationModule } from '../organization/organization.module';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { AuthContextRepository } from './auth-context.repository';
import { AuthContextService } from './auth-context.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_EXPIRES_IN } from './constants/auth.constants';
import { DevelopmentAuthGuard } from './guards/development-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserContextGuard } from './guards/user-context.guard';
import { RefreshTokenRepository } from './refresh-token.repository';
import { SessionRepository } from './session.repository';
import { SupportSessionRepository } from './support-session.repository';
import { TrustedDeviceRepository } from './trusted-device.repository';
import { VerificationTokenRepository } from './verification-token.repository';
import { VerificationTokenService } from './verification-token.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: configService.get<string>(
            'jwt.accessExpiresIn',
            ACCESS_TOKEN_EXPIRES_IN,
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    UsersModule,
    OrganizationModule,
    BillingModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthContextRepository,
    AuthContextService,
    AuthRepository,
    RefreshTokenRepository,
    SessionRepository,
    SupportSessionRepository,
    TrustedDeviceRepository,
    VerificationTokenRepository,
    VerificationTokenService,
    AuthService,
    JwtAccessStrategy,
    DevelopmentAuthGuard,
    JwtAuthGuard,
    UserContextGuard,
  ],
  exports: [
    AuthContextRepository,
    AuthContextService,
    AuthRepository,
    RefreshTokenRepository,
    SessionRepository,
    SupportSessionRepository,
    TrustedDeviceRepository,
    VerificationTokenRepository,
    VerificationTokenService,
    AuthService,
    DevelopmentAuthGuard,
    JwtAuthGuard,
    UserContextGuard,
    JwtModule,
  ],
})
export class AuthModule {}
