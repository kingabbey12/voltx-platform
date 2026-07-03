import {
  generateVerificationToken,
  hashVerificationToken,
} from '../src/modules/auth/utils/verification-token.util';

describe('verification-token.util', () => {
  it('generates unique verification tokens and stable hashes', () => {
    const tokenA = generateVerificationToken();
    const tokenB = generateVerificationToken();

    expect(tokenA).not.toBe(tokenB);
    expect(hashVerificationToken(tokenA)).toHaveLength(64);
    expect(hashVerificationToken(tokenA)).toBe(hashVerificationToken(tokenA));
  });
});
