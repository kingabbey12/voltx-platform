import { ApiProperty } from '@nestjs/swagger';
import { DeveloperConnectOnboardingStatus } from '@prisma/client';

export class OnboardingLinkResponseDto {
  @ApiProperty({ example: 'https://connect.stripe.com/setup/e/acct_.../abc123' })
  url!: string;
}

export class DeveloperConnectStatusResponseDto {
  @ApiProperty({ enum: DeveloperConnectOnboardingStatus })
  onboardingStatus!: DeveloperConnectOnboardingStatus;
  @ApiProperty() payoutsEnabled!: boolean;
}
