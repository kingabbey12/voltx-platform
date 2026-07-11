import { Injectable } from '@nestjs/common';
import {
  BackgroundJobFailureRepository,
  PaginatedBackgroundJobFailures,
} from './background-job-failure.repository';

@Injectable()
export class BackgroundJobFailureService {
  constructor(private readonly repository: BackgroundJobFailureRepository) {}

  async listForCurrentOrganization(
    page: number,
    limit: number,
  ): Promise<PaginatedBackgroundJobFailures> {
    return this.repository.findAllForOrganization(page, limit);
  }
}
