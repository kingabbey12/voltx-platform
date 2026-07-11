import { Module } from '@nestjs/common';
import { BackgroundJobFailureRepository } from './background-job-failure.repository';
import { BackgroundJobFailureService } from './background-job-failure.service';
import { BackgroundJobsController } from './background-jobs.controller';
import { DeadLetterListenerService } from './dead-letter-listener.service';

@Module({
  controllers: [BackgroundJobsController],
  providers: [
    BackgroundJobFailureRepository,
    BackgroundJobFailureService,
    DeadLetterListenerService,
  ],
  exports: [BackgroundJobFailureService],
})
export class BackgroundJobsModule {}
