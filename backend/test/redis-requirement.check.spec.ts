const mockConnect = jest.fn();
const mockPing = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      ping: mockPing,
      disconnect: mockDisconnect,
    })),
  };
});

// Imported after the mock so the mocked ioredis module is what gets wired in.
import { assertRedisRequirement } from '../src/bootstrap/redis-requirement.check';

describe('assertRedisRequirement', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('throws in production when REDIS_ENABLED is not "true"', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_ENABLED;

    await expect(assertRedisRequirement()).rejects.toThrow(/REDIS_ENABLED must be set/);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('does nothing outside production when Redis is disabled', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_ENABLED;

    await expect(assertRedisRequirement()).resolves.toBeUndefined();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('pings Redis and resolves when enabled and reachable', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_ENABLED = 'true';
    mockConnect.mockResolvedValue(undefined);
    mockPing.mockResolvedValue('PONG');

    await expect(assertRedisRequirement()).resolves.toBeUndefined();
    expect(mockConnect).toHaveBeenCalled();
    expect(mockPing).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('throws with a clear message when Redis is enabled but unreachable', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_ENABLED = 'true';
    mockConnect.mockRejectedValue(new Error('connection refused'));

    await expect(assertRedisRequirement()).rejects.toThrow(/not reachable/);
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
