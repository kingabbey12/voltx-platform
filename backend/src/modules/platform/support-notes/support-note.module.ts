import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { UsersModule } from '../../users/users.module';
import { SupportNoteController } from './support-note.controller';
import { SupportNoteRepository } from './support-note.repository';
import { SupportNoteService } from './support-note.service';

@Module({
  imports: [UsersModule],
  controllers: [SupportNoteController],
  providers: [SupportNoteRepository, SupportNoteService, PlatformAdminGuard],
})
export class SupportNoteModule {}
