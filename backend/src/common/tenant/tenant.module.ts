import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ACCESS_TOKEN_EXPIRES_IN } from '../../modules/auth/constants/auth.constants';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';
import { TenantMiddleware } from './tenant.middleware';

@Global()
@Module({
  imports: [
    ConfigModule,
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
  ],
  providers: [TenantContextService, TenantMiddleware, TenantGuard],
  exports: [TenantContextService, TenantGuard],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
