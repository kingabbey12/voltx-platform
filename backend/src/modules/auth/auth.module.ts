import { Global, Module } from '@nestjs/common';
import { AuthContextRepository } from './auth-context.repository';
import { AuthContextService } from './auth-context.service';
import { DevelopmentAuthGuard } from './guards/development-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserContextGuard } from './guards/user-context.guard';

@Global()
@Module({
  providers: [
    AuthContextRepository,
    AuthContextService,
    DevelopmentAuthGuard,
    JwtAuthGuard,
    UserContextGuard,
  ],
  exports: [
    AuthContextRepository,
    AuthContextService,
    DevelopmentAuthGuard,
    JwtAuthGuard,
    UserContextGuard,
  ],
})
export class AuthModule {}
