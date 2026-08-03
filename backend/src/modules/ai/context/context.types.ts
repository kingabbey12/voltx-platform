export type ExecutiveContextSource =
  'crm' | 'finance' | 'operations' | 'communications' | 'notifications' | 'calendar';

export const EXECUTIVE_CONTEXT_INVALIDATOR = Symbol('EXECUTIVE_CONTEXT_INVALIDATOR');

export interface ExecutiveContextInvalidator {
  invalidateTenant(tenantId: string): Promise<void>;
  invalidateUser(tenantId: string, userId: string): Promise<void>;
  invalidateSource(
    tenantId: string,
    source: ExecutiveContextSource,
    userId?: string,
  ): Promise<void>;
}

export type ExecutiveContextPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ExecutiveContextItem {
  id: string;
  label: string;
  priority: ExecutiveContextPriority;
  occurredAt?: string;
  amount?: number;
  details?: Record<string, string | number | boolean | null>;
}

export interface ExecutiveContextSection {
  items: ExecutiveContextItem[];
  total: number;
  summary: string;
}

export interface ExecutiveContextMetadata {
  generatedAt: string;
  contextVersion: '1.0';
  tenantId: string;
  userId: string;
  sourcesIncluded: ExecutiveContextSource[];
  excludedSources: Array<{ source: ExecutiveContextSource; reason: string }>;
  tokenEstimate: number;
}

export interface ExecutiveContext {
  organization: { id: string };
  user: { id: string };
  crm: ExecutiveContextSection;
  finance: ExecutiveContextSection;
  operations: ExecutiveContextSection;
  communications: ExecutiveContextSection;
  notifications: ExecutiveContextSection;
  calendar: ExecutiveContextSection;
  metadata: ExecutiveContextMetadata;
}

export interface ExecutiveContextBuildOptions {
  permissions: string[];
  maxItemsPerSource?: number;
}
