import { Global, Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { NotificationController } from './notification.controller';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

// Global (like AuditModule/AuthModule/MetricsModule) so any module can
// inject NotificationService to raise a real, in-app notification
// without needing an explicit module-level import — v1.9.1 wires real
// producers in from AIModule (approvals) and AttachmentsModule
// (quarantine), both of which CommunicationsModule already imports, so
// an explicit `imports: [NotificationModule]` on either would be a new
// circular edge through CommunicationsModule. @Global() sidesteps that
// entirely: NotificationModule is imported once (here, and by
// AppModule), and every other module gets NotificationService for free.
@Global()
@Module({
  imports: [CommunicationsModule],
  controllers: [NotificationController],
  providers: [NotificationRepository, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
