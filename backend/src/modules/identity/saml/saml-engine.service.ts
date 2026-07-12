import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SAML, SamlConfig } from '@node-saml/node-saml';

type SignatureAlgorithm = 'sha1' | 'sha256' | 'sha512';
import { XMLParser } from 'fast-xml-parser';
import { EncryptionService } from '../../integrations/security/encryption.service';
import { SamlConfigurationEntity } from '../entities/identity-provider.entity';

export interface SamlProfile {
  nameId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  groups: string[];
  raw: Record<string, unknown>;
}

export interface ParsedSamlMetadata {
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl: string | null;
  idpCertificate: string;
}

/**
 * Single SAML 2.0 protocol engine shared by every preset — presets only
 * change form defaults/attribute-mapping hints (see presets/), never the
 * signature-verification path itself, which is entirely delegated to the
 * vetted @node-saml/node-saml library.
 */
@Injectable()
export class SamlEngineService {
  constructor(
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  buildAcsUrl(identityProviderId: string): string {
    return `${this.getWebhookBaseUrl()}/api/v1/auth/sso/saml/${identityProviderId}/acs`;
  }

  private getWebhookBaseUrl(): string {
    const base = this.configService.get<string>('integrations.webhookBaseUrl', '');
    if (!base) {
      throw new BadRequestException(
        'INTEGRATIONS_WEBHOOK_BASE_URL must be configured to construct SAML callback URLs',
      );
    }
    return base.replace(/\/$/, '');
  }

  private buildSaml(config: SamlConfigurationEntity, identityProviderId: string): SAML {
    const idpCert = this.encryptionService.decrypt(config.idpCertificate);
    const samlConfig: SamlConfig = {
      idpCert,
      issuer: config.spEntityId,
      callbackUrl: this.buildAcsUrl(identityProviderId),
      entryPoint: config.idpSsoUrl,
      logoutUrl: config.idpSloUrl ?? undefined,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      wantAssertionsSigned: config.wantAssertionsSigned,
      signatureAlgorithm: toSignatureAlgorithm(config.signatureAlgorithm),
    };
    return new SAML(samlConfig);
  }

  async getLoginRedirectUrl(
    config: SamlConfigurationEntity,
    identityProviderId: string,
    relayState: string,
  ): Promise<string> {
    const saml = this.buildSaml(config, identityProviderId);
    return saml.getAuthorizeUrlAsync(relayState, undefined, {});
  }

  async validateAssertion(
    config: SamlConfigurationEntity,
    identityProviderId: string,
    samlResponse: string,
    relayState?: string,
  ): Promise<SamlProfile> {
    const saml = this.buildSaml(config, identityProviderId);
    const { profile } = await saml.validatePostResponseAsync({
      SAMLResponse: samlResponse,
      ...(relayState ? { RelayState: relayState } : {}),
    });

    if (!profile) {
      throw new BadRequestException('SAML assertion did not contain a usable profile');
    }

    const email =
      profile.email ?? profile.mail ?? (isEmail(profile.nameID) ? profile.nameID : null);

    const groupsRaw = profile.groups ?? profile.memberOf ?? profile.MemberOf;
    const groups = Array.isArray(groupsRaw)
      ? groupsRaw.map(String)
      : typeof groupsRaw === 'string'
        ? [groupsRaw]
        : [];

    return {
      nameId: profile.nameID,
      email,
      firstName:
        (profile.firstName as string | undefined) ??
        (profile.givenName as string | undefined) ??
        null,
      lastName:
        (profile.lastName as string | undefined) ?? (profile.sn as string | undefined) ?? null,
      groups,
      raw: profile as unknown as Record<string, unknown>,
    };
  }

  generateSpMetadata(config: SamlConfigurationEntity, identityProviderId: string): string {
    const saml = this.buildSaml(config, identityProviderId);
    return saml.generateServiceProviderMetadata(null, null);
  }

  /**
   * Minimal, purpose-scoped IdP metadata parser: extracts exactly the three
   * fields our SamlConfiguration needs (entityId, SSO redirect endpoint,
   * signing certificate) from a standard IdPSSODescriptor document. Not a
   * general-purpose SAML metadata library — malformed/unexpected shapes are
   * rejected rather than best-effort guessed.
   */
  parseIdpMetadata(metadataXml: string): ParsedSamlMetadata {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    let doc: unknown;
    try {
      doc = parser.parse(metadataXml);
    } catch {
      throw new BadRequestException('Metadata XML could not be parsed');
    }

    const entityDescriptor = unwrap(doc, 'md:EntityDescriptor') ?? unwrap(doc, 'EntityDescriptor');
    if (!entityDescriptor) {
      throw new BadRequestException('Metadata XML does not contain an EntityDescriptor');
    }

    const entityId = entityDescriptor['@_entityID'];
    if (!entityId || typeof entityId !== 'string') {
      throw new BadRequestException('Metadata XML is missing entityID');
    }

    const idpDescriptor =
      unwrap(entityDescriptor, 'md:IDPSSODescriptor') ??
      unwrap(entityDescriptor, 'IDPSSODescriptor');
    if (!idpDescriptor) {
      throw new BadRequestException('Metadata XML does not contain an IDPSSODescriptor');
    }

    const ssoServices = asArray(
      unwrapRaw(idpDescriptor, 'md:SingleSignOnService') ??
        unwrapRaw(idpDescriptor, 'SingleSignOnService'),
    );
    const redirectBinding = ssoServices.find(
      (svc) => svc['@_Binding'] === 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
    );
    const ssoUrl = (redirectBinding ?? ssoServices[0])?.['@_Location'];
    if (!ssoUrl || typeof ssoUrl !== 'string') {
      throw new BadRequestException(
        'Metadata XML does not contain a usable SingleSignOnService endpoint',
      );
    }

    const sloServices = asArray(
      unwrapRaw(idpDescriptor, 'md:SingleLogoutService') ??
        unwrapRaw(idpDescriptor, 'SingleLogoutService'),
    );
    const idpSloUrl = (sloServices[0]?.['@_Location'] as string | undefined) ?? null;

    const certificate = extractSigningCertificate(idpDescriptor);
    if (!certificate) {
      throw new BadRequestException('Metadata XML does not contain a signing certificate');
    }

    return { idpEntityId: entityId, idpSsoUrl: ssoUrl, idpSloUrl, idpCertificate: certificate };
  }
}

function toSignatureAlgorithm(value: string): SignatureAlgorithm {
  return value === 'sha1' || value === 'sha512' ? value : 'sha256';
}

function isEmail(value: string | undefined | null): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function unwrapRaw(node: Record<string, unknown>, key: string): unknown {
  return node[key];
}

function unwrap(node: unknown, key: string): Record<string, unknown> | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const value = (node as Record<string, unknown>)[key];
  if (Array.isArray(value)) return value[0] as Record<string, unknown>;
  return value as Record<string, unknown> | undefined;
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  return Array.isArray(value)
    ? (value as Record<string, unknown>[])
    : [value as Record<string, unknown>];
}

function extractSigningCertificate(idpDescriptor: Record<string, unknown>): string | null {
  const keyDescriptors = asArray(
    idpDescriptor['md:KeyDescriptor'] ?? idpDescriptor['KeyDescriptor'],
  );
  const signingKey =
    keyDescriptors.find((kd) => kd['@_use'] === 'signing' || kd['@_use'] === undefined) ??
    keyDescriptors[0];
  if (!signingKey) return null;

  const keyInfo = unwrap(signingKey, 'ds:KeyInfo') ?? unwrap(signingKey, 'KeyInfo');
  const x509Data = keyInfo
    ? (unwrap(keyInfo, 'ds:X509Data') ?? unwrap(keyInfo, 'X509Data'))
    : undefined;
  const cert = x509Data
    ? (x509Data['ds:X509Certificate'] ?? x509Data['X509Certificate'])
    : undefined;

  if (typeof cert !== 'string') return null;
  return cert.replace(/\s+/g, '');
}
