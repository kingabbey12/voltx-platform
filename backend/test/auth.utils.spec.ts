import { hashPassword, verifyPassword } from '../src/modules/auth/utils/password.util';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../src/modules/auth/utils/refresh-token.util';

describe('password.util', () => {
  it('hashes and verifies passwords', async () => {
    const password = 'SecurePassword123!';
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', passwordHash)).resolves.toBe(false);
  });
});

describe('refresh-token.util', () => {
  it('generates unique refresh tokens and stable hashes', () => {
    const tokenA = generateRefreshToken();
    const tokenB = generateRefreshToken();

    expect(tokenA).not.toBe(tokenB);
    expect(hashRefreshToken(tokenA)).toHaveLength(64);
    expect(hashRefreshToken(tokenA)).toBe(hashRefreshToken(tokenA));
  });
});
