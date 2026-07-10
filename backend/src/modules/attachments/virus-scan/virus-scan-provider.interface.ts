export interface VirusScanResult {
  clean: boolean;
  /** Threat signature name, e.g. "Eicar-Test-Signature" — only set when clean is false. */
  threat?: string;
  /** True when scanning didn't run at all (e.g. no scanner configured) — distinct from a clean result. */
  skipped: boolean;
}

export interface VirusScanProvider {
  readonly name: string;
  scan(buffer: Buffer): Promise<VirusScanResult>;
}

export const VIRUS_SCAN_PROVIDER = Symbol('VIRUS_SCAN_PROVIDER');
