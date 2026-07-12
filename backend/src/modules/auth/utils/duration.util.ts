/** Parses a `jwt`-style short duration string ("15m", "5m", "30d", ...) into
 * seconds. Shared by AuthService's access-token expiry calculation and the
 * v2.2 MFA challenge token expiry so the same "Nd/Nh/Nm/Ns" convention isn't
 * parsed twice with two slightly different regexes. */
export function parseDurationToSeconds(value: string, fallbackSeconds: number): number {
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    return fallbackSeconds;
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 60 * 60 * 24;
    default:
      return fallbackSeconds;
  }
}
