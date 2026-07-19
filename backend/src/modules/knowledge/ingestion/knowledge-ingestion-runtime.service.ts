import { Injectable } from '@nestjs/common';

@Injectable()
export class KnowledgeIngestionRuntimeService {
  private readonly abortControllers = new Map<string, AbortController>();

  register(jobId: string): AbortSignal {
    const controller = new AbortController();
    this.abortControllers.set(jobId, controller);
    return controller.signal;
  }

  unregister(jobId: string): void {
    this.abortControllers.delete(jobId);
  }

  cancel(jobId: string): boolean {
    const controller = this.abortControllers.get(jobId);
    if (!controller) {
      return false;
    }

    controller.abort();
    return true;
  }
}
