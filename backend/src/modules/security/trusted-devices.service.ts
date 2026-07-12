import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { TrustedDeviceRecord, TrustedDeviceRepository } from '../auth/trusted-device.repository';
import { TrustDeviceDto, TrustedDeviceResponseDto } from './dto/trusted-device.dto';

function toResponseDto(record: TrustedDeviceRecord): TrustedDeviceResponseDto {
  return {
    id: record.id,
    label: record.label,
    trustedUntil: record.trustedUntil.toISOString(),
    lastSeenAt: record.lastSeenAt.toISOString(),
  };
}

@Injectable()
export class TrustedDevicesService {
  constructor(
    private readonly trustedDeviceRepository: TrustedDeviceRepository,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async list(userId: string, organizationId: string): Promise<TrustedDeviceResponseDto[]> {
    const records = await this.trustedDeviceRepository.listActiveForUserInOrganization(
      userId,
      organizationId,
    );
    return records.map(toResponseDto);
  }

  /** Lets an already-authenticated user pre-trust the current device
   * without going through an MFA challenge first (e.g. before MFA is even
   * enabled yet) — MfaService.verifyLogin() is the other, more common path
   * that creates a TrustedDevice, as a side effect of `trustDevice: true`. */
  async trust(
    userId: string,
    organizationId: string,
    dto: TrustDeviceDto,
  ): Promise<TrustedDeviceResponseDto> {
    const days =
      dto.trustedForDays ?? this.configService.get<number>('mfa.trustedDeviceDefaultDays', 30);
    const trustedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const record = await this.trustedDeviceRepository.upsertTrust(
      userId,
      organizationId,
      dto.deviceFingerprint,
      trustedUntil,
      dto.label,
    );

    await this.auditService.record({
      action: 'trusted_device.trusted',
      resource: 'trusted_device',
      resourceId: record.id,
    });

    return toResponseDto(record);
  }

  async revoke(id: string, userId: string, organizationId: string): Promise<void> {
    const record = await this.trustedDeviceRepository.findByIdForUserInOrganization(
      id,
      userId,
      organizationId,
    );
    if (!record) {
      throw new NotFoundException('Trusted device not found');
    }

    await this.trustedDeviceRepository.revoke(id);
    await this.auditService.record({
      action: 'trusted_device.revoked',
      resource: 'trusted_device',
      resourceId: id,
    });
  }
}
