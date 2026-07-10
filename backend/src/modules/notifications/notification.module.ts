import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { NotificationController } from './notification.controller';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

@Module({
  imports: [CommunicationsModule],
  controllers: [NotificationController],
  providers: [NotificationRepository, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
