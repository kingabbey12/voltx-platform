import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleListResponseDto, RoleResponseDto } from './dto/role-response.dto';
import { RoleRepository } from './role.repository';

@Injectable()
export class RoleService {
  constructor(private readonly roleRepository: RoleRepository) {}

  async findAll(): Promise<RoleListResponseDto> {
    const roles = await this.roleRepository.findAll();
    return {
      items: roles.map((role) => RoleResponseDto.fromEntity(role)),
    };
  }

  async findOne(id: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }

    return RoleResponseDto.fromEntity(role);
  }

  async findByKey(key: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findByKey(key);
    if (!role) {
      throw new NotFoundException(`Role with key "${key}" not found`);
    }

    return RoleResponseDto.fromEntity(role);
  }
}
