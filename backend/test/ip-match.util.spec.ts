import { ipMatchesAllowlist } from '../src/modules/security/utils/ip-match.util';

describe('ipMatchesAllowlist', () => {
  it('matches an exact IPv4 address', () => {
    expect(ipMatchesAllowlist('203.0.113.7', ['203.0.113.7'])).toBe(true);
  });

  it('does not match a different exact IPv4 address', () => {
    expect(ipMatchesAllowlist('203.0.113.8', ['203.0.113.7'])).toBe(false);
  });

  it('matches an IPv4 address inside a CIDR range', () => {
    expect(ipMatchesAllowlist('10.1.2.3', ['10.0.0.0/8'])).toBe(true);
  });

  it('does not match an IPv4 address outside a CIDR range', () => {
    expect(ipMatchesAllowlist('11.1.2.3', ['10.0.0.0/8'])).toBe(false);
  });

  it('matches a /32 CIDR as an exact address', () => {
    expect(ipMatchesAllowlist('203.0.113.7', ['203.0.113.7/32'])).toBe(true);
    expect(ipMatchesAllowlist('203.0.113.8', ['203.0.113.7/32'])).toBe(false);
  });

  it('matches a /0 CIDR as allow-all', () => {
    expect(ipMatchesAllowlist('8.8.8.8', ['0.0.0.0/0'])).toBe(true);
  });

  it('normalizes IPv4-mapped IPv6 addresses before matching', () => {
    expect(ipMatchesAllowlist('::ffff:203.0.113.7', ['203.0.113.7'])).toBe(true);
  });

  it('matches an exact IPv6 address (no CIDR support)', () => {
    expect(ipMatchesAllowlist('2001:db8::1', ['2001:db8::1'])).toBe(true);
    expect(ipMatchesAllowlist('2001:db8::2', ['2001:db8::1'])).toBe(false);
  });

  it('returns false for an empty allowlist entry list on a real IP', () => {
    expect(ipMatchesAllowlist('203.0.113.7', [])).toBe(false);
  });

  it('rejects a malformed CIDR entry rather than throwing', () => {
    expect(ipMatchesAllowlist('203.0.113.7', ['not-a-cidr/8'])).toBe(false);
  });
});
