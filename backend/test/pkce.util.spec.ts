import {
  computeCodeChallengeS256,
  verifyPkce,
} from '../src/modules/oauth-provider/utils/pkce.util';

describe('PKCE (RFC 7636) utilities', () => {
  // The exact test vector from RFC 7636 Appendix B.
  const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

  it('computes the S256 code_challenge matching the RFC 7636 test vector', () => {
    expect(computeCodeChallengeS256(codeVerifier)).toBe(expectedChallenge);
  });

  it('verifies a matching verifier/challenge pair', () => {
    expect(verifyPkce(codeVerifier, expectedChallenge)).toBe(true);
  });

  it('rejects a verifier that does not match the challenge', () => {
    expect(verifyPkce('some-other-verifier-that-is-definitely-wrong-here', expectedChallenge)).toBe(
      false,
    );
  });
});
