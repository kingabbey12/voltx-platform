import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { ListUsersQueryDto, PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';
import { UpdateCurrentUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async getMe(): Promise<UserResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const user = await this.usersRepository.findById(tenant.userId);
    if (!user) {
      throw new NotFoundException(`User with id "${tenant.userId}" not found`);
    }

    return UserResponseDto.fromEntity(user);
  }

  async updateMe(dto: UpdateCurrentUserDto): Promise<UserResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const user = await this.usersRepository.update(tenant.userId, dto);
    if (!user) {
      throw new NotFoundException(`User with id "${tenant.userId}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'user',
      resourceId: user.id,
      metadata: dto as Record<string, unknown>,
    });

    return UserResponseDto.fromEntity(user);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (user) {
      return UserResponseDto.fromEntity(user);
    }

    const existsInAnotherTenant = await this.usersRepository.existsInAnotherTenant(id);
    if (existsInAnotherTenant) {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    }

    throw new NotFoundException(`User with id "${id}" not found`);
  }

  async findAll(query: ListUsersQueryDto): Promise<PaginatedUsersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.usersRepository.findAll({
      page,
      limit,
      status: query.status,
      search: query.search,
    });

    return {
      items: result.items.map((item) => UserResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
