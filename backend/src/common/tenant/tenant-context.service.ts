import { ForbiddenException, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TenantContext } from './interfaces/tenant-context.interface';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<Partial<TenantContext>>();

  run<T>(initialContext: Partial<TenantContext>, callback: () => T): T {
    return this.storage.run({ ...initialContext }, callback);
  }

  set(context: Partial<TenantContext>): void {
    const store = this.storage.getStore();
    if (store) {
      Object.assign(store, context);
      return;
    }

    this.storage.enterWith({ ...context });
  }

  get(): Partial<TenantContext> | undefined {
    return this.storage.getStore();
  }

  getOrThrow(): TenantContext {
    const context = this.storage.getStore();

    if (
      !context?.organizationId ||
      !context.userId ||
      !context.membershipId ||
      !context.requestId
    ) {
      throw new ForbiddenException('Valid tenant context is required');
    }

    return {
      organizationId: context.organizationId,
      userId: context.userId,
      membershipId: context.membershipId,
      requestId: context.requestId,
    };
  }

  isComplete(): boolean {
    const context = this.storage.getStore();
    return Boolean(
      context?.organizationId && context.userId && context.membershipId && context.requestId,
    );
  }

  assertOrganizationAccess(organizationId: string): void {
    const tenant = this.getOrThrow();
    if (tenant.organizationId !== organizationId) {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    }
  }
}
