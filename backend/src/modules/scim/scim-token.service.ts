import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CreateScimTokenDto } from './dto/scim-token.dto';
import { ScimTokenEntity } from './entities/scim-token.entity';
import { ScimTokenRepository } from './scim-token.repository';
import { generateScimToken, hashScimToken } from './utils/scim-token.util';

@Injectable()
export class ScimTokenService {
  constructor(
    private readonly scimTokenRepository: ScimTokenRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateScimTokenDto,
  ): Promise<{ entity: ScimTokenEntity; token: string }> {
    const token = generateScimToken();
    const entity = await this.scimTokenRepository.create({
      organizationId,
      identityProviderId: dto.identityProviderId,
      name: dto.name,
      tokenHash: hashScimToken(token),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'scim_token',
      resourceId: entity.id,
      metadata: { organizationId },
    });

    return { entity, token };
  }

  async list(organizationId: string): Promise<ScimTokenEntity[]> {
    return this.scimTokenRepository.listByOrganization(organizationId);
  }

  async revoke(organizationId: string, id: string): Promise<void> {
    const token = await this.scimTokenRepository.findByIdInOrg(organizationId, id);
    if (!token) {
      throw new NotFoundException('SCIM token not found');
    }
    await this.scimTokenRepository.revoke(id);
    await this.auditService.record({
      action: 'revoke',
      resource: 'scim_token',
      resourceId: id,
      metadata: { organizationId },
    });
  }
}
