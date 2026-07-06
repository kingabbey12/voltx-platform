import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthTokensDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...' })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn!: number;
}

export class LoginResponseDto extends AuthTokensDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

export class AuthMeResponseDto extends UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  organizationId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  membershipId!: string;

  @ApiProperty({ example: ['admin'] })
  roles!: string[];

  @ApiProperty({ example: ['user.read', 'organization.read'] })
  permissions!: string[];
}

export class MyOrganizationResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  organizationId!: string;

  @ApiProperty({ example: 'Acme Energy' })
  organizationName!: string;

  @ApiProperty({ example: 'acme-energy' })
  organizationSlug!: string;

  @ApiProperty({ example: 'owner' })
  roleKey!: string;

  @ApiProperty({ example: 'Owner' })
  roleName!: string;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  joinedAt!: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'If the account exists, a password reset email has been sent.' })
  message!: string;
}

export class VerifyEmailResponseDto {
  @ApiProperty({ example: 'Email verified successfully' })
  message!: string;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  emailVerifiedAt!: string;
}
