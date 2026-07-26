import {
  cronTickKey,
  InProcessDistributedLockService,
  RedisDistributedLockService,
} from '../src/common/scheduling/distributed-lock.service';

describe('InProcessDistributedLockService', () => {
  let lock: InProcessDistributedLockService;

  beforeEach(() => {
    lock = new InProcessDistributedLockService();
  });

  it('runs the task and reports that it ran', async () => {
    const task = jest.fn().mockResolvedValue(undefined);

    await expect(lock.runExclusive('sweep', 1000, task)).resolves.toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('refuses a second concurrent runExclusive on the same key', async () => {
    let releaseFirst: () => void = () => undefined;
    const firstTask = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );
    const secondTask = jest.fn().mockResolvedValue(undefined);

    const first = lock.runExclusive('sweep', 1000, firstTask);
    const secondRan = await lock.runExclusive('sweep', 1000, secondTask);

    expect(secondRan).toBe(false);
    expect(secondTask).not.toHaveBeenCalled();

    releaseFirst();
    await expect(first).resolves.toBe(true);
  });

  it('allows different keys to run concurrently', async () => {
    let releaseFirst: () => void = () => undefined;
    const first = lock.runExclusive(
      'sweep-a',
      1000,
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );

    await expect(lock.runExclusive('sweep-b', 1000, () => Promise.resolve())).resolves.toBe(true);

    releaseFirst();
    await first;
  });

  it('releases the lock once the task settles, so the next tick can run', async () => {
    await lock.runExclusive('sweep', 1000, () => Promise.resolve());

    await expect(lock.runExclusive('sweep', 1000, () => Promise.resolve())).resolves.toBe(true);
  });

  it('releases the lock even when the task throws', async () => {
    await expect(
      lock.runExclusive('sweep', 1000, () => Promise.reject(new Error('sweep failed'))),
    ).rejects.toThrow('sweep failed');

    await expect(lock.runExclusive('sweep', 1000, () => Promise.resolve())).resolves.toBe(true);
  });

  it('holds runOncePerWindow past completion so a late replica still sees the tick as taken', async () => {
    await expect(lock.runOncePerWindow('tick', 60_000, () => Promise.resolve())).resolves.toBe(
      true,
    );

    const secondTask = jest.fn();
    await expect(lock.runOncePerWindow('tick', 60_000, secondTask)).resolves.toBe(false);
    expect(secondTask).not.toHaveBeenCalled();
  });

  it('lets a new window through once the previous one has elapsed', async () => {
    jest.useFakeTimers();
    try {
      await lock.runOncePerWindow('tick', 60_000, () => Promise.resolve());
      jest.advanceTimersByTime(60_001);

      await expect(lock.runOncePerWindow('tick', 60_000, () => Promise.resolve())).resolves.toBe(
        true,
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('RedisDistributedLockService', () => {
  type RedisStub = {
    set: jest.Mock;
    eval: jest.Mock;
    on: jest.Mock;
    connect: jest.Mock;
    quit: jest.Mock;
    status: string;
  };

  /** Lets every already-resolved promise in the acquire path settle while
   *  fake timers are installed (which rules out timer-based flushing). */
  const flushMicrotasks = async (): Promise<void> => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  };

  function buildLock(overrides: Partial<RedisStub> = {}): {
    lock: RedisDistributedLockService;
    client: RedisStub;
  } {
    const client: RedisStub = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue('OK'),
      status: 'ready',
      ...overrides,
    };
    const lock = new RedisDistributedLockService({
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    } as never);
    // The constructor builds a real (lazy, unconnected) ioredis client; drop it
    // before swapping in the stub so Jest has no socket left holding the run open.
    const real = (lock as unknown as { client: { disconnect: () => void } }).client;
    real.disconnect();
    (lock as unknown as { client: RedisStub }).client = client;
    return { lock, client };
  }

  it('acquires with SET NX PX so only one replica can win', async () => {
    const { lock, client } = buildLock();

    await lock.runExclusive('sweep', 30_000, () => Promise.resolve());

    expect(client.set).toHaveBeenCalledWith(
      'voltx:lock:sweep',
      expect.any(String),
      'PX',
      30_000,
      'NX',
    );
  });

  it('skips the task when another replica already holds the lock', async () => {
    const { lock } = buildLock({ set: jest.fn().mockResolvedValue(null) });
    const task = jest.fn();

    await expect(lock.runExclusive('sweep', 30_000, task)).resolves.toBe(false);
    expect(task).not.toHaveBeenCalled();
  });

  it('fails closed: skips the task when Redis is unreachable', async () => {
    const { lock } = buildLock({
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const task = jest.fn();

    await expect(lock.runExclusive('sweep', 30_000, task)).resolves.toBe(false);
    expect(task).not.toHaveBeenCalled();
  });

  it('releases with an ownership check rather than an unconditional DEL', async () => {
    const { lock, client } = buildLock();

    await lock.runExclusive('sweep', 30_000, () => Promise.resolve());

    const [script, keyCount, key, token] = client.eval.mock.calls.at(-1) as [
      string,
      number,
      string,
      string,
    ];
    expect(script).toContain('redis.call("del", KEYS[1])');
    expect(script).toContain('== ARGV[1]');
    expect(keyCount).toBe(1);
    expect(key).toBe('voltx:lock:sweep');
    expect(token).toEqual(expect.any(String));
  });

  it('releases the lock even when the task throws', async () => {
    const { lock, client } = buildLock();

    await expect(
      lock.runExclusive('sweep', 30_000, () => Promise.reject(new Error('sweep failed'))),
    ).rejects.toThrow('sweep failed');
    expect(client.eval).toHaveBeenCalled();
  });

  it('extends the lock while a task outlives its TTL', async () => {
    jest.useFakeTimers();
    try {
      const { lock, client } = buildLock();
      let finish: () => void = () => undefined;
      const run = lock.runExclusive(
        'sweep',
        3_000,
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      await flushMicrotasks();

      jest.advanceTimersByTime(3_000);
      await flushMicrotasks();
      const extendCalls = client.eval.mock.calls.filter(([script]) =>
        (script as string).includes('pexpire'),
      );
      expect(extendCalls.length).toBeGreaterThan(0);

      finish();
      await run;
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not release runOncePerWindow, so the claim outlives the task', async () => {
    const { lock, client } = buildLock();

    await expect(lock.runOncePerWindow('tick', 60_000, () => Promise.resolve())).resolves.toBe(
      true,
    );
    expect(client.eval).not.toHaveBeenCalled();
  });
});

describe('cronTickKey', () => {
  it('maps replicas firing the same tick with millisecond drift to one key', () => {
    const replicaA = cronTickKey('billing-nightly', new Date('2026-07-26T02:00:00.001Z'));
    const replicaB = cronTickKey('billing-nightly', new Date('2026-07-26T02:00:00.487Z'));

    expect(replicaA).toBe(replicaB);
  });

  it('rounds to the nearest second so a slightly-early replica still matches', () => {
    const early = cronTickKey('billing-nightly', new Date('2026-07-26T01:59:59.998Z'));
    const late = cronTickKey('billing-nightly', new Date('2026-07-26T02:00:00.300Z'));

    expect(early).toBe(late);
  });

  it('gives consecutive ticks distinct keys, down to per-second cron expressions', () => {
    const first = cronTickKey('workflow-schedule:s1', new Date('2026-07-26T02:00:00.000Z'));
    const second = cronTickKey('workflow-schedule:s1', new Date('2026-07-26T02:00:01.000Z'));

    expect(first).not.toBe(second);
  });

  it('scopes the key per job so unrelated schedules never collide', () => {
    const firedAt = new Date('2026-07-26T02:00:00.000Z');

    expect(cronTickKey('workflow-schedule:s1', firedAt)).not.toBe(
      cronTickKey('workflow-schedule:s2', firedAt),
    );
  });
});
