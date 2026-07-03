import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'One-time email verification token' })
  @IsString()
  @MinLength(1)
  token!: string;
}
