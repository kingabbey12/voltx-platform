import { ConfigService } from '@nestjs/config';
import { OAuthProviderConfig } from './integration-provider.types';

export function googleOAuthConfig(
  configService: ConfigService,
  scopes: string[],
): OAuthProviderConfig {
  return {
    clientId: configService.get<string>('integrations.providers.google.clientId', ''),
    clientSecret: configService.get<string>('integrations.providers.google.clientSecret', ''),
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes,
  };
}

export function microsoftOAuthConfig(
  configService: ConfigService,
  scopes: string[],
): OAuthProviderConfig {
  const tenantId = configService.get<string>('integrations.providers.microsoft.tenantId', 'common');
  return {
    clientId: configService.get<string>('integrations.providers.microsoft.clientId', ''),
    clientSecret: configService.get<string>('integrations.providers.microsoft.clientSecret', ''),
    authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    scopes: [...scopes, 'offline_access'],
  };
}

export function slackOAuthConfig(
  configService: ConfigService,
  scopes: string[],
): OAuthProviderConfig {
  return {
    clientId: configService.get<string>('integrations.providers.slack.clientId', ''),
    clientSecret: configService.get<string>('integrations.providers.slack.clientSecret', ''),
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes,
  };
}

export function githubOAuthConfig(
  configService: ConfigService,
  scopes: string[],
): OAuthProviderConfig {
  return {
    clientId: configService.get<string>('integrations.providers.github.clientId', ''),
    clientSecret: configService.get<string>('integrations.providers.github.clientSecret', ''),
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes,
  };
}
