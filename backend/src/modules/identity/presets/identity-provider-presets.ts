import { IdentityProviderPreset, IdentityProviderProtocol } from '@prisma/client';

/**
 * A preset is purely a set of sane defaults/attribute-mapping hints applied
 * when an admin picks it in the setup wizard — it does not change the
 * underlying protocol handling, which is identical for every preset sharing
 * a protocol (one SAML engine, one OIDC engine; see saml/saml-engine.service.ts
 * and oidc/oidc-engine.service.ts).
 */
export interface IdentityProviderPresetDefinition {
  preset: IdentityProviderPreset;
  label: string;
  protocol: IdentityProviderProtocol;
  /** Claim/attribute name the profile's group/role membership is read from, for role-mapping rules. */
  groupsClaim: string;
  /** Claim/attribute name the profile's email is read from, when not the SAML NameID or OIDC standard `email` claim. */
  emailClaim?: string;
  /** OIDC only — default scopes to request. */
  defaultScopes?: string[];
  setupNotes: string;
}

export const IDENTITY_PROVIDER_PRESETS: Record<
  IdentityProviderPreset,
  IdentityProviderPresetDefinition
> = {
  GENERIC: {
    preset: 'GENERIC',
    label: 'Generic SAML / OIDC',
    protocol: 'SAML',
    groupsClaim: 'groups',
    setupNotes: 'Any SAML 2.0 or OpenID Connect compliant identity provider.',
  },
  ENTRA_ID: {
    preset: 'ENTRA_ID',
    label: 'Microsoft Entra ID',
    protocol: 'OIDC',
    groupsClaim: 'groups',
    emailClaim: 'preferred_username',
    defaultScopes: ['openid', 'email', 'profile'],
    setupNotes:
      'Register an App Registration in Entra ID; use the v2.0 OIDC issuer ' +
      '(https://login.microsoftonline.com/{tenant}/v2.0) and enable the "groups" optional claim.',
  },
  OKTA: {
    preset: 'OKTA',
    label: 'Okta',
    protocol: 'OIDC',
    groupsClaim: 'groups',
    defaultScopes: ['openid', 'email', 'profile', 'groups'],
    setupNotes:
      'Create an OIDC (or SAML) app integration in Okta; add a "groups" scope/claim via an ' +
      'Authorization Server claim if role mapping by group is required.',
  },
  GOOGLE_WORKSPACE: {
    preset: 'GOOGLE_WORKSPACE',
    label: 'Google Workspace',
    protocol: 'OIDC',
    groupsClaim: 'hd',
    defaultScopes: ['openid', 'email', 'profile'],
    setupNotes:
      'Google Workspace does not emit group membership in the ID token by default — role ' +
      'mapping typically falls back to defaultRoleKey unless a custom claim is configured.',
  },
  ONELOGIN: {
    preset: 'ONELOGIN',
    label: 'OneLogin',
    protocol: 'SAML',
    groupsClaim: 'MemberOf',
    setupNotes: 'Create a SAML Custom Connector app in OneLogin; map the "MemberOf" attribute.',
  },
  PING_IDENTITY: {
    preset: 'PING_IDENTITY',
    label: 'Ping Identity',
    protocol: 'SAML',
    groupsClaim: 'memberOf',
    setupNotes: 'Create a SAML application in PingOne/PingFederate; map the "memberOf" attribute.',
  },
};
