import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionRepository } from '../permissions/permission.repository';
import { generateApiKeySecret, sha256Hex } from '../security/utils/security-hash.util';
import {
  CreatePersonalAccessTokenDto,
  CreatePersonalAccessTokenResponseDto,
  PersonalAccessTokenResponseDto,
} from './dto/personal-access-token.dto';
import { PersonalAccessTokenRepository } from './personal-access-token.repository';

/**
 * Unlike ApiKeysService (which validates scopedPermissions against the
 * caller's CURRENT org permissions at creation time, since an API key is
 * bound to exactly one org), a Personal Access Token is user-scoped and
 * may be used across every organization its owner belongs to. Creation
 * only validates that requested keys are real, known permission keys —
 * the actual "can never exceed what's held" enforcement happens per
 * request, in PersonalAccessTokenGuard, by intersecting this token's
 * frozen scopedPermissions with whatever the *current* org membership's
 * role grants for the specific organization named in that request. This
 * is strictly safer than a creation-time-only check: a later role
 * downgrade in one org immediately narrows what the token can do there,
 * without needing to touch the token itself.
 */
@Injectable()
export class PersonalAccessTokenService {
  constructor(
    private readonly repository: PersonalAccessTokenRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly configService: ConfigService,
  ) {}

  async create(
    userId: string,
    dto: CreatePersonalAccessTokenDto,
  ): Promise<CreatePersonalAccessTokenResponseDto> {
    await this.assertPermissionKeysAreKnown(dto.scopedPermissions);

    const prefixConfig = this.configService.get<string>(
      'developerPlatform.personalAccessTokenPrefix',
      'vpat',
    );
    const secret = generateApiKeySecret();
    const rawToken = `${prefixConfig}_${secret}`;
    const tokenHash = sha256Hex(rawToken);
    const tokenPrefix = `${prefixConfig}_${secret.slice(0, 8)}...`;

    const entity = await this.repository.create({
      userId,
      name: dto.name,
      tokenHash,
      tokenPrefix,
      scopedPermissions: dto.scopedPermissions,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    // Not recorded in AuditLog: that log is per-organization and
    // hash-chained (v2.2 Compliance Center) — a PAT is user-scoped, not
    // org-scoped, so there is no single organization whose chain this
    // action belongs to. Every *use* of the token is still fully
    // attributed within whichever org's AuditLog it acts in, via the
    // normal tenant-context-derived userId on each of those rows.
    return { ...PersonalAccessTokenResponseDto.fromEntity(entity), token: rawToken };
  }

  list(userId: string): Promise<PersonalAccessTokenResponseDto[]> {
    return this.repository
      .listByUser(userId)
      .then((entities) =>
        entities.map((entity) => PersonalAccessTokenResponseDto.fromEntity(entity)),
      );
  }

  async revoke(id: string, userId: string): Promise<void> {
    const entity = await this.repository.findByIdForUser(id, userId);
    if (!entity) {
      throw new NotFoundException('Personal access token not found');
    }
    if (entity.revokedAt) {
      throw new ForbiddenException('Personal access token already revoked');
    }
    await this.repository.revoke(id);
  }

  private async assertPermissionKeysAreKnown(requested: string[]): Promise<void> {
    const allPermissions = await this.permissionRepository.findAll();
    const knownKeys = new Set(allPermissions.map((permission) => permission.key));
    const unknown = requested.filter((key) => !knownKeys.has(key));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown permission key(s): ${unknown.join(', ')}`);
    }
  }
}
