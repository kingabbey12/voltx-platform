import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * Wire-format query params for GET /oauth/authorize — deliberately
 * snake_case (client_id, redirect_uri, etc.) because these are the exact
 * OAuth 2.0 (RFC 6749) query parameter names a third party's own redirect
 * URL contains; the Voltx web app's consent page forwards them to this
 * endpoint unchanged. PKCE (RFC 7636) is mandatory and S256-only — "plain"
 * is rejected.
 */
export class OAuthAuthorizeQueryDto {
  @ApiProperty({ example: 'client_9fY3zAb12cd34' })
  @IsString()
  client_id!: string;

  @ApiProperty({ example: 'https://acme.example/oauth/callback' })
  @IsUrl({ require_protocol: true })
  redirect_uri!: string;

  @ApiProperty({ example: 'code', description: 'Only the authorization_code flow is supported' })
  @IsIn(['code'])
  response_type!: string;

  @ApiProperty({
    example: 'sales.opportunity.read sales.contact.read',
    description: 'Space-delimited scope keys',
  })
  @IsString()
  scope!: string;

  @ApiPropertyOptional({ example: 'xyz123' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' })
  @IsString()
  code_challenge!: string;

  @ApiProperty({ example: 'S256', description: 'Only S256 is supported — "plain" is rejected' })
  @IsIn(['S256'])
  code_challenge_method!: string;
}

export class DecideOAuthAuthorizationDto {
  @ApiProperty({ example: 'client_9fY3zAb12cd34' })
  @IsString()
  client_id!: string;

  @ApiProperty({ example: 'https://acme.example/oauth/callback' })
  @IsUrl({ require_protocol: true })
  redirect_uri!: string;

  @ApiProperty({ example: 'sales.opportunity.read sales.contact.read' })
  @IsString()
  scope!: string;

  @ApiPropertyOptional({ example: 'xyz123' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' })
  @IsString()
  code_challenge!: string;

  @ApiProperty({ example: 'S256' })
  @IsIn(['S256'])
  code_challenge_method!: string;

  @ApiProperty({ enum: ['approve', 'deny'] })
  @IsIn(['approve', 'deny'])
  decision!: 'approve' | 'deny';
}

export class OAuthScopeDescriptionDto {
  @ApiProperty({ example: 'sales.opportunity.read' }) key!: string;
  @ApiProperty({ example: 'Read sales opportunities' }) description!: string;
}

export class OAuthConsentContextResponseDto {
  @ApiProperty() applicationId!: string;
  @ApiProperty() applicationName!: string;
  @ApiPropertyOptional({ nullable: true }) applicationLogoUrl!: string | null;
  @ApiProperty() organizationId!: string;
  @ApiProperty({ type: [OAuthScopeDescriptionDto] }) scopes!: OAuthScopeDescriptionDto[];
  @ApiProperty() redirectUri!: string;
  @ApiPropertyOptional({ nullable: true }) state!: string | null;
}

export class OAuthDecisionResponseDto {
  @ApiProperty({
    example: 'https://acme.example/oauth/callback?code=...&state=xyz123',
    description: 'The web app must navigate the browser to this URL to complete the flow',
  })
  redirectUrl!: string;
}
