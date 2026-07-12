import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { MfaChallengePayload } from '../auth/interfaces/jwt-payload.interface';
import { SessionRepository } from '../auth/session.repository';
import { TrustedDeviceRepository } from '../auth/trusted-device.repository';
import { UsersRepository } from '../users/users.repository';
import { EncryptionService } from '../integrations/security/encryption.service';
import { MfaVerifyLoginDto } from './dto/mfa.dto';
import { MfaRepository } from './mfa.repository';
import { generateBackupCodes, sha256Hex } from './utils/security-hash.util';
import {
  generateTotpSecret,
  generateTotpUri,
  isTotpCodeShape,
  verifyTotpCode,
} from './utils/totp.util';

export interface VerifyLoginRequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly mfaRepository: MfaRepository,
    private readonly usersRepository: UsersRepository,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly sessionRepository: SessionRepository,
    private readonly trustedDeviceRepository: TrustedDeviceRepository,
    private readonly auditService: AuditService,
  ) {}

  async setup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const profile = await this.usersRepository.findById(userId);
    if (!profile) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    const secret = generateTotpSecret();
    await this.mfaRepository.setPendingSecret(userId, this.encryptionService.encrypt(secret));

    const issuer = this.configService.get<string>('mfa.totpIssuer', 'Voltx');
    const otpauthUrl = generateTotpUri(issuer, profile.email, secret);

    await this.auditService.record({
      action: 'mfa.setup_started',
      resource: 'user',
      resourceId: userId,
    });

    return { secret, otpauthUrl };
  }

  async verifySetup(userId: string, code: string): Promise<string[]> {
    const state = await this.mfaRepository.findState(userId);
    if (!state?.mfaSecret) {
      throw new BadRequestException('MFA setup has not been started');
    }

    const secret = this.encryptionService.decrypt(state.mfaSecret);
    const valid = await verifyTotpCode(secret, code);
    if (!valid) {
      throw new BadRequestException('Invalid verification code');
    }

    const backupCodes = generateBackupCodes(
      this.configService.get<number>('mfa.backupCodeCount', 10),
    );
    await this.mfaRepository.enable(
      userId,
      state.mfaSecret,
      backupCodes.map((code_) => sha256Hex(code_)),
    );

    await this.auditService.record({
      action: 'mfa.enabled',
      resource: 'user',
      resourceId: userId,
    });

    return backupCodes;
  }

  async disable(userId: string, code: string): Promise<void> {
    const state = await this.requireEnabledState(userId);
    const valid = await this.verifyFactor(userId, state, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.mfaRepository.disable(userId);
    await this.auditService.record({
      action: 'mfa.disabled',
      resource: 'user',
      resourceId: userId,
    });
  }

  async regenerateBackupCodes(userId: string, code: string): Promise<string[]> {
    const state = await this.requireEnabledState(userId);
    const valid = await this.verifyFactor(userId, state, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const backupCodes = generateBackupCodes(
      this.configService.get<number>('mfa.backupCodeCount', 10),
    );
    await this.mfaRepository.replaceBackupCodeHashes(
      userId,
      backupCodes.map((code_) => sha256Hex(code_)),
    );

    await this.auditService.record({
      action: 'mfa.backup_codes_regenerated',
      resource: 'user',
      resourceId: userId,
    });

    return backupCodes;
  }

  /**
   * Second half of the two-step MFA login flow. Independently verifies the
   * challenge token AuthService.login() issued (never trusts it implicitly)
   * and a fresh TOTP/backup code, then — and only then — reaches the exact
   * same token-issuance path (AuthService.buildLoginResponse ->
   * AuthService.issueTokens) that a normal password-only login uses.
   */
  async verifyLogin(
    dto: MfaVerifyLoginDto,
    requestMeta?: VerifyLoginRequestMeta,
  ): Promise<LoginResponseDto> {
    const payload = await this.decodeChallengeToken(dto.challengeToken);
    const state = await this.requireEnabledState(payload.sub);

    const valid = await this.verifyFactor(payload.sub, state, dto.code);
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (dto.trustDevice && dto.deviceFingerprint) {
      const days =
        dto.trustedForDays ?? this.configService.get<number>('mfa.trustedDeviceDefaultDays', 30);
      const trustedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      await this.trustedDeviceRepository.upsertTrust(
        payload.sub,
        payload.org,
        dto.deviceFingerprint,
        trustedUntil,
      );
    }

    const session = await this.sessionRepository.create({
      userId: payload.sub,
      organizationId: payload.org,
      deviceFingerprint: dto.deviceFingerprint,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    await this.auditService.recordWithExplicitActor({
      action: 'mfa.login_verified',
      resource: 'session',
      resourceId: session.id,
      organizationId: payload.org,
      userId: payload.sub,
    });

    return this.authService.buildLoginResponse(payload.sub, payload.org, session.id);
  }

  private async decodeChallengeToken(token: string): Promise<MfaChallengePayload> {
    let payload: MfaChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<MfaChallengePayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }

    if (
      payload.type !== 'mfa_challenge' ||
      typeof payload.sub !== 'string' ||
      typeof payload.org !== 'string'
    ) {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }

    return payload;
  }

  private async requireEnabledState(
    userId: string,
  ): Promise<{ mfaSecret: string; mfaBackupCodesHash: string[] }> {
    const state = await this.mfaRepository.findState(userId);
    if (!state?.mfaEnabled || !state.mfaSecret) {
      throw new BadRequestException('Multi-factor authentication is not enabled for this account');
    }
    return { mfaSecret: state.mfaSecret, mfaBackupCodesHash: state.mfaBackupCodesHash };
  }

  /** Accepts either a fresh 6-digit TOTP code or a single-use backup code,
   * distinguished purely by shape. Backup codes are consumed atomically on
   * successful use (see MfaRepository.consumeBackupCodeHash). */
  private async verifyFactor(
    userId: string,
    state: { mfaSecret: string; mfaBackupCodesHash: string[] },
    code: string,
  ): Promise<boolean> {
    if (isTotpCodeShape(code)) {
      const secret = this.encryptionService.decrypt(state.mfaSecret);
      return verifyTotpCode(secret, code);
    }

    const codeHash = sha256Hex(code.trim().toUpperCase());
    return this.mfaRepository.consumeBackupCodeHash(userId, codeHash);
  }
}
