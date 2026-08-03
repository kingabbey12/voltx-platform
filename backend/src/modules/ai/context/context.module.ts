import { Controller, Get, Global, Module, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { DashboardModule } from '../../dashboard/dashboard.module';
import { CommunicationsModule } from '../../communications/communications.module';
import { FinanceModule } from '../../finance/finance.module';
import { NotificationModule } from '../../notifications/notification.module';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { SalesModule } from '../../sales/sales.module';
import { WorkflowModule } from '../../workflows/workflow.module';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { ExecutiveContextBuilder } from './context.builder';
import { ExecutiveContextResponseDto } from './context.dto';
import {
  CommunicationsContextProvider,
  CrmContextProvider,
  FinanceContextProvider,
  NotificationsContextProvider,
  OperationsContextProvider,
} from './context.providers';
import { ExecutiveContextInvalidationService, ExecutiveContextService } from './context.service';
import { ExecutiveContext } from './context.types';
import { EXECUTIVE_CONTEXT_INVALIDATOR } from './context.types';

@ApiTags('AI Executive Context')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Controller('ai/context')
export class ExecutiveContextController {
  constructor(private readonly contextService: ExecutiveContextService) {}

  @Get()
  @Permissions('ai.agent.run')
  @ApiOkResponse({ type: ExecutiveContextResponseDto })
  getContext(@CurrentUser() user: CurrentUserInterface): Promise<ExecutiveContext> {
    return this.contextService.getExecutiveContext({ permissions: user.permissions });
  }
}

@Global()
@Module({
  imports: [
    SalesModule,
    FinanceModule,
    DashboardModule,
    CommunicationsModule,
    NotificationModule,
    WorkflowModule,
  ],
  controllers: [ExecutiveContextController],
  providers: [
    ExecutiveContextBuilder,
    CrmContextProvider,
    FinanceContextProvider,
    OperationsContextProvider,
    CommunicationsContextProvider,
    NotificationsContextProvider,
    ExecutiveContextInvalidationService,
    { provide: EXECUTIVE_CONTEXT_INVALIDATOR, useExisting: ExecutiveContextInvalidationService },
    ExecutiveContextService,
  ],
  exports: [
    EXECUTIVE_CONTEXT_INVALIDATOR,
    ExecutiveContextInvalidationService,
    ExecutiveContextService,
  ],
})
export class ExecutiveContextModule {}
