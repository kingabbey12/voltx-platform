import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { CompanyService, CompanyHomeResponse, RecordTimelineResponse } from './company.service';

/**
 * Company home (docs/design/COMPANY.md): the canonical place a business
 * understands itself, and the timeline every canonical record shows.
 * Read-only projections over existing modules — see CompanyService for the
 * reconciliation to COMPANY.md's seven primitives.
 */
@ApiTags('Company')
@ApiBearerAuth('JWT')
@Controller('company')
@UseGuards(...AUTH_GUARDS)
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  @Get('home')
  @ApiOperation({
    summary:
      'The Company home: organization, people, documents, conversations, events, and promises',
  })
  @ApiOkResponse({ description: 'The Company home projection' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  getHome(@CurrentUser() user: CurrentUserInterface): Promise<CompanyHomeResponse> {
    const { organizationId } = this.tenantContextService.getOrThrow();
    return this.companyService.getHome(organizationId, user.permissions);
  }

  @Get('timeline/:recordType/:recordId')
  @ApiOperation({
    summary:
      "A canonical record's timeline: created, updated, related events, conversations, documents, promises",
  })
  @ApiOkResponse({ description: 'The record timeline' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  getTimeline(
    @Param('recordType') recordType: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<RecordTimelineResponse> {
    return this.companyService.getTimeline(recordType, recordId, user.permissions);
  }
}
