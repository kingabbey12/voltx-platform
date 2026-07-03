import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCurrentUserDto {
  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/jane.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl?: string;

  @ApiPropertyOptional({ example: '+14155552671' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Engineering Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;
}

export class CreateUserDataDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/jane.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl?: string;

  @ApiPropertyOptional({ example: '+14155552671' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Engineering Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
