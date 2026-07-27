import { readFileSync, existsSync, accessSync, constants } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');

describe('Database backup — regression', () => {
  describe('deploy/scripts/backup.sh', () => {
    const scriptPath = join(REPO_ROOT, 'deploy', 'scripts', 'backup.sh');

    it('exists and is executable', () => {
      expect(existsSync(scriptPath)).toBe(true);
      expect(readFileSync(scriptPath, 'utf-8').startsWith('#!/usr/bin/env bash')).toBe(true);

      // This assertion previously checked only the shebang, so it passed while
      // the file was mode 644. deploy.sh invokes the script directly, so the
      // missing execute bit made every deploy's pre-migration backup fail with
      // "permission denied" — and deploy.sh only warns and continues, so
      // migrations ran with no backup while CI stayed green.
      expect(() => accessSync(scriptPath, constants.X_OK)).not.toThrow();
    });

    const script = readFileSync(scriptPath, 'utf-8');

    it('has --help flag', () => {
      expect(script).toContain('--help');
    });

    it('supports --docker mode', () => {
      expect(script).toContain('--docker');
    });

    it('supports --direct mode with DATABASE_URL', () => {
      expect(script).toContain('--direct');
    });

    it('runs pg_dump via docker compose exec', () => {
      expect(script).toContain('docker compose');
      expect(script).toContain('pg_dump');
    });

    it('verifies gzip integrity after backup', () => {
      expect(script).toContain('gzip -t');
    });

    it('prunes old backups', () => {
      expect(script).toContain('RETENTION_DAYS');
      expect(script).toContain('mtime');
    });

    it('has configurable BACKUP_DIR and BACKUP_RETENTION_DAYS', () => {
      expect(script).toContain('BACKUP_DIR');
      expect(script).toContain('BACKUP_RETENTION_DAYS');
    });
  });

  describe('deploy/deploy.sh — backup integration', () => {
    const scriptPath = join(REPO_ROOT, 'deploy', 'deploy.sh');
    const script = readFileSync(scriptPath, 'utf-8');

    it('has --skip-backup flag', () => {
      expect(script).toContain('--skip-backup');
    });

    it('calls backup.sh before migrations', () => {
      expect(script).toContain('pre-migration backup');
      expect(script).toContain('backup.sh');
    });

    it('runs backup before Step 4 (migrations)', () => {
      const backupLine = script.indexOf('pre-migration');
      const migrateLine = script.indexOf('Run migrations');
      expect(backupLine).toBeGreaterThan(0);
      expect(migrateLine).toBeGreaterThan(backupLine);
    });

    it('displays restore instructions on completion', () => {
      expect(script).toContain('Restore:');
      expect(script).toContain('gunzip');
    });
  });

  describe('deploy/crontab', () => {
    const crontabPath = join(REPO_ROOT, 'deploy', 'crontab');

    it('exists', () => {
      expect(existsSync(crontabPath)).toBe(true);
    });

    const crontab = readFileSync(crontabPath, 'utf-8');

    it('has a daily schedule at 3 AM UTC', () => {
      expect(crontab).toContain('0 3 * * *');
    });

    it('references backup.sh', () => {
      expect(crontab).toContain('backup.sh');
    });

    it('mentions weekly integrity check', () => {
      expect(crontab).toContain('integrity');
    });
  });

  describe('docs/operations/backup-and-restore.md', () => {
    const docPath = join(REPO_ROOT, 'docs', 'operations', 'backup-and-restore.md');

    it('exists', () => {
      expect(existsSync(docPath)).toBe(true);
    });

    const doc = readFileSync(docPath, 'utf-8');

    it('documents deploy/scripts/backup.sh', () => {
      expect(doc).toContain('deploy/scripts/backup.sh');
    });

    it('documents the --skip-backup option', () => {
      expect(doc).toContain('--skip-backup');
    });

    it('documents restore procedure', () => {
      expect(doc).toContain('Restore');
      expect(doc).toContain('gunzip');
    });

    it('documents scheduled backup via crontab', () => {
      expect(doc).toContain('crontab');
    });

    it('documents backup verification', () => {
      expect(doc).toContain('## Verification');
      expect(doc).toContain('unverified backup');
    });
  });

  describe('backend/scripts/backup-db.sh (legacy)', () => {
    const scriptPath = join(REPO_ROOT, 'backend', 'scripts', 'backup-db.sh');

    it('still exists for backward compatibility', () => {
      expect(existsSync(scriptPath)).toBe(true);
    });
  });
});
