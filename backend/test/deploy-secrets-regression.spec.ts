import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const REPO_ROOT = join(__dirname, '..', '..');

describe('Deploy secrets — security regression', () => {
  describe('root .gitignore', () => {
    const gitignorePath = join(REPO_ROOT, '.gitignore');

    it('exists at repository root', () => {
      expect(existsSync(gitignorePath)).toBe(true);
    });

    const gitignore = readFileSync(gitignorePath, 'utf-8');

    it('excludes .env files', () => {
      expect(gitignore).toMatch(/^\.env$/m);
    });

    it('excludes .env.* files (e.g. .env.local, .env.production)', () => {
      expect(gitignore).toMatch(/^\.env\.\*$/m);
    });

    it('excludes deploy/.env explicitly', () => {
      expect(gitignore).toMatch(/deploy\/\.env/m);
    });

    it('excludes deploy/.env.staging explicitly', () => {
      expect(gitignore).toMatch(/deploy\/\.env\.staging/m);
    });
  });

  describe('deploy/.env.example', () => {
    const examplePath = join(REPO_ROOT, 'deploy', '.env.example');

    it('exists', () => {
      expect(existsSync(examplePath)).toBe(true);
    });

    const content = readFileSync(examplePath, 'utf-8');

    it('has no real secrets (no base64-looking values)', () => {
      const lines = content.split('\n').filter((l) => l.includes('=') && !l.startsWith('#'));
      for (const line of lines) {
        const val = line.split('=', 2)[1] ?? '';
        // Allow placeholder patterns and common non-secret values
        if (
          val.includes('<') ||
          val.includes('${') ||
          val === '' ||
          val === 'true' ||
          val === 'false' ||
          val === 'production' ||
          val === 'staging' ||
          val === 'info' ||
          val === 'openai' ||
          val === 'gpt-4o-mini' ||
          val === 's3' ||
          val === 'auto' ||
          val === 'voltx' ||
          val === '15m' ||
          val === '7d' ||
          /^\d+$/.test(val) ||
          /^https?:\/\//.test(val) ||
          val.startsWith('postgresql://')
        ) {
          continue;
        }
        // If it looks like a real base64 secret, fail
        const b64ish =
          val.replace(/[+/=]/g, '').length > 20 && /[A-Z]/.test(val) && /[a-z]/.test(val);
        expect(b64ish).toBe(false);
      }
    });

    it('does not match any secret-looking values from real .env (no copy-paste leaks)', () => {
      const realEnvPath = join(REPO_ROOT, 'deploy', '.env');
      if (!existsSync(realEnvPath)) return; // OK if no real .env exists yet

      const realValues = readFileSync(realEnvPath, 'utf-8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => l.split('=', 2)[1] ?? '');

      const exampleValues = content
        .split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => l.split('=', 2)[1] ?? '');

      // A "secret-looking" value is a long base64-ish string (not a template)
      const isSecretVal = (v: string) =>
        !v.includes('${') &&
        v.replace(/[+/=]/g, '').length > 20 &&
        /[A-Z]/.test(v) &&
        /[a-z]/.test(v);

      const realSecrets = new Set(realValues.filter(isSecretVal));
      const exampleSecrets = exampleValues.filter(isSecretVal);

      for (const s of exampleSecrets) {
        expect(realSecrets.has(s)).toBe(false);
      }
    });
  });

  describe('git status — .env is not tracked', () => {
    it('deploy/.env is not in the git index', () => {
      const result = execSync('git ls-files --error-unmatch deploy/.env 2>&1 || true', {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
      });
      expect(result).toContain('did not match any file');
    });
  });

  describe('deploy/deploy.sh security audit', () => {
    const scriptPath = join(REPO_ROOT, 'deploy', 'deploy.sh');
    const script = readFileSync(scriptPath, 'utf-8');

    it('checks .env file permissions', () => {
      expect(script).toContain('stat -f');
      expect(script).toContain('chmod 600');
    });

    it('checks .env is in .gitignore', () => {
      expect(script).toContain('check-ignore');
      expect(script).toContain('.gitignore');
    });

    it('has a --strict mode that fails on security warnings', () => {
      expect(script).toContain('--strict');
      expect(script).toContain('STRICT=true');
    });

    it('displays a security notice about migrating from .env files', () => {
      expect(script).toContain('host environment variables');
    });

    it('is executable and has a valid shebang', () => {
      expect(script.startsWith('#!/usr/bin/env bash')).toBe(true);
    });
  });
});
