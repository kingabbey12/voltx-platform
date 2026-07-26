import { readFileSync } from 'fs';
import { join } from 'path';
import { load as parseYaml } from 'js-yaml';

interface ServiceDef {
  cpus?: string;
  mem_limit?: string;
  mem_reservation?: string;
  deploy?: Record<string, unknown>;
}

interface ComposeFile {
  services?: Record<string, ServiceDef>;
}

function loadCompose(relativePath: string): ComposeFile {
  const fullPath = join(__dirname, '..', '..', relativePath);
  const raw = readFileSync(fullPath, 'utf-8');
  return parseYaml(raw) as ComposeFile;
}

const EXEMPT_SERVICES = ['bootstrap', 'e2e', 'migrate'];

function isLongRunning(name: string): boolean {
  return !EXEMPT_SERVICES.includes(name);
}

describe('Docker Compose — resource limits', () => {
  const composeFiles: { label: string; path: string }[] = [
    { label: 'root dev compose', path: 'docker-compose.yml' },
    { label: 'backend dev compose', path: 'backend/docker-compose.yml' },
    { label: 'backend prod compose', path: 'backend/docker-compose.prod.yml' },
    { label: 'staging compose', path: 'deploy/docker-compose.yml' },
  ];

  for (const { label, path } of composeFiles) {
    describe(label, () => {
      const compose = loadCompose(path);
      const { services } = compose;

      it('is valid YAML and has a services block', () => {
        expect(services).toBeDefined();
        expect(Object.keys(services!).length).toBeGreaterThan(0);
      });

      it('every long-running service has cpus, mem_limit, and mem_reservation', () => {
        for (const [name, svc] of Object.entries(services ?? {})) {
          if (!isLongRunning(name)) continue;
          expect(`${name}.cpus`).toBeDefined();
          expect(`${name}.mem_limit`).toBeDefined();
          expect(`${name}.mem_reservation`).toBeDefined();
          expect(svc.cpus).toBeDefined();
          expect(svc.mem_limit).toBeDefined();
          expect(svc.mem_reservation).toBeDefined();
        }
      });

      it('uses top-level resource keys (no deploy.resources)', () => {
        for (const [name, svc] of Object.entries(services ?? {})) {
          if (svc.deploy) {
            expect(`${name}.deploy`).toBeUndefined();
          }
        }
      });
    });
  }

  describe('staging limit values are reasonable', () => {
    const services = loadCompose('deploy/docker-compose.yml').services ?? {};

    it('nginx is given the tightest limits', () => {
      expect(services.nginx?.mem_limit).toBe('128m');
      expect(services.nginx?.cpus).toBe('0.5');
    });

    it('postgres gets the highest memory allowance', () => {
      expect(services.postgres?.mem_limit).toBe('2g');
    });

    it('api has 1g and web has 512m memory', () => {
      expect(services.api?.mem_limit).toBe('1g');
      expect(services.web?.mem_limit).toBe('512m');
    });

    it('all long-running services have mem_reservation set', () => {
      const names = ['postgres', 'redis', 'api', 'web', 'prometheus', 'grafana', 'nginx'];
      for (const name of names) {
        expect(services[name]?.mem_reservation).toBeDefined();
      }
    });
  });
});
