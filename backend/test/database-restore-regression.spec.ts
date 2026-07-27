import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the restore half of disaster recovery.
 *
 * `backup.sh` existed for some time with no counterpart, which meant recovery
 * was an untested hypothesis: nobody had ever proven an archive could be loaded
 * back. `restore.sh` and `restore-drill.sh` close that, and these assertions
 * keep their safety properties from being quietly removed.
 *
 * The drill itself needs a running Postgres container, so it is not executed
 * here — run `deploy/scripts/restore-drill.sh`. What is enforced here is that
 * the scripts exist, are runnable, and keep the guards that make an operator
 * unable to destroy the wrong database.
 */
describe('Database restore — regression', () => {
  const repoRoot = join(__dirname, '..', '..');
  const restorePath = join(repoRoot, 'deploy/scripts/restore.sh');
  const drillPath = join(repoRoot, 'deploy/scripts/restore-drill.sh');

  describe.each([
    ['restore.sh', restorePath],
    ['restore-drill.sh', drillPath],
  ])('%s', (_name, path) => {
    it('exists, is bash, and is actually executable', () => {
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, 'utf-8').startsWith('#!/usr/bin/env bash')).toBe(true);
      expect(() => accessSync(path, constants.X_OK)).not.toThrow();
    });

    it('aborts on error rather than continuing past a failed step', () => {
      expect(readFileSync(path, 'utf-8')).toContain('set -euo pipefail');
    });
  });

  describe('restore.sh safety guards', () => {
    const script = readFileSync(restorePath, 'utf-8');

    it('verifies archive integrity before touching the database', () => {
      // A truncated archive must be caught before the schema is dropped,
      // otherwise a failed restore leaves an empty database.
      const integrityIndex = script.indexOf('gzip -t');
      const dropIndex = script.indexOf('DROP SCHEMA');
      expect(integrityIndex).toBeGreaterThan(-1);
      expect(integrityIndex).toBeLessThan(dropIndex);
    });

    it('requires confirmation unless --force is given', () => {
      expect(script).toContain('--force');
      expect(script).toContain('Confirmation did not match');
    });

    it('supports --expect-db so a mistyped target cannot be destroyed', () => {
      expect(script).toContain('--expect-db');
      expect(script).toContain('Refusing to restore');
    });

    it('fails when a restore produces an empty schema', () => {
      // "Succeeded but restored nothing" is the failure mode that would
      // otherwise be reported as success.
      expect(script).toContain('the schema is empty');
    });

    it('supports both the docker and direct modes backup.sh writes for', () => {
      expect(script).toContain('--docker');
      expect(script).toContain('--direct');
    });
  });

  describe('restore-drill.sh proves the round trip', () => {
    const drill = readFileSync(drillPath, 'utf-8');

    it.each([
      ['compares a checksum, not just row counts', 'sum(amount_cents)'],
      ['asserts the schema was genuinely emptied first', 'expected 0 tables after destruction'],
      ['verifies indexes survive', 'custom index'],
      ['verifies foreign keys survive', 'foreign key constraint'],
      ['verifies sequences advanced, so post-restore writes do not collide', 'post-restore-write'],
    ])('%s', (_case, marker) => {
      expect(drill).toContain(marker);
    });

    it('cleans up its throwaway database even on failure', () => {
      expect(drill).toContain('trap cleanup EXIT');
    });
  });

  describe('the runbook records the measured recovery characteristics', () => {
    const runbook = readFileSync(join(repoRoot, 'docs/operations/backup-and-restore.md'), 'utf-8');

    it.each(['RTO', 'RPO', 'restore-drill.sh'])('documents %s', (marker) => {
      expect(runbook).toContain(marker);
    });
  });
});
