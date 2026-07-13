import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { CODE_VERIFIER_PATTERN } from '../utils/pkce.util';

/**
 * RFC 6749 §4.1.3/§6 token endpoint request. Deliberately supports only
 * `authorization_code` and `refresh_token` grants — `client_credentials`
 * is intentionally unsupported so every issued token always traces back
 * to an authorizing human/service-account (see the Phase 2 plan's risk
 * note). Field names are snake_case to match every real OAuth2 client
 * library's request shape verbatim.
 */
export class ExchangeOAuthTokenDto {
  @ApiProperty({ enum: ['authorization_code', 'refresh_token'] })
  @IsIn(['authorization_code', 'refresh_token'])
  grant_type!: 'authorization_code' | 'refresh_token';

  @ApiPropertyOptional()
  @ValidateIf((dto: ExchangeOAuthTokenDto) => dto.grant_type === 'authorization_code')
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: ExchangeOAuthTokenDto) => dto.grant_type === 'authorization_code')
  @IsString()
  redirect_uri?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: ExchangeOAuthTokenDto) => dto.grant_type === 'authorization_code')
  @Matches(CODE_VERIFIER_PATTERN)
  code_verifier?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: ExchangeOAuthTokenDto) => dto.grant_type === 'refresh_token')
  @IsString()
  refresh_token?: string;

  @ApiProperty()
  @IsString()
  client_id!: string;

  @ApiProperty()
  @IsString()
  client_secret!: string;
}

export class OAuthTokenResponseDto {
  @ApiProperty({ example: 'voat_ab12cd34_9fY3z...' }) access_token!: string;
  @ApiProperty({ example: 'Bearer' }) token_type!: 'Bearer';
  @ApiProperty({ example: 3600 }) expires_in!: number;
  @ApiProperty({ example: 'vort_ab12cd34_9fY3z...' }) refresh_token!: string;
  @ApiProperty({ example: 'sales.opportunity.read sales.contact.read' }) scope!: string;
}

/** RFC 7009 — always returns 200 regardless of whether the token was found,
 * to avoid a token-scanning oracle. */
export class RevokeOAuthTokenDto {
  @ApiProperty() @IsString() token!: string;
  @ApiPropertyOptional({ enum: ['access_token', 'refresh_token'] })
  @IsOptional()
  @IsIn(['access_token', 'refresh_token'])
  token_type_hint?: 'access_token' | 'refresh_token';
  @ApiProperty() @IsString() client_id!: string;
  @ApiProperty() @IsString() client_secret!: string;
}

/** RFC 7662 — an application may only introspect tokens it itself issued. */
export class IntrospectOAuthTokenDto {
  @ApiProperty() @IsString() token!: string;
  @ApiProperty() @IsString() client_id!: string;
  @ApiProperty() @IsString() client_secret!: string;
}

export class OAuthIntrospectResponseDto {
  @ApiProperty() active!: boolean;
  @ApiPropertyOptional() scope?: string;
  @ApiPropertyOptional() client_id?: string;
  @ApiPropertyOptional({ description: 'Opaque identifier of the authorizing user' }) sub?: string;
  @ApiPropertyOptional({ description: 'Unix timestamp (seconds)' }) exp?: number;
  @ApiPropertyOptional({ description: 'Unix timestamp (seconds)' }) iat?: number;
  @ApiPropertyOptional() token_type?: 'access_token' | 'refresh_token';
}
