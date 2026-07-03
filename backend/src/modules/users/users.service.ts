import { Injectable, NotFoundException } from '@nestjs/common';
import { ListUsersQueryDto, PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';
import { UpdateCurrentUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    return UserResponseDto.fromEntity(user);
  }

  async updateMe(userId: string, dto: UpdateCurrentUserDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.update(userId, dto);
    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    return UserResponseDto.fromEntity(user);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return UserResponseDto.fromEntity(user);
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
