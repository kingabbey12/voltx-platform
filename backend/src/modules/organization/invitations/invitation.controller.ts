import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { LoginResponseDto, MessageResponseDto } from '../../auth/dto/auth-response.dto';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreateInvitationResponseDto,
  InvitationPreviewResponseDto,
  InvitationResponseDto,
  ListInvitationsQueryDto,
  PaginatedInvitationsDto,
} from './dto/invitation.dto';
import { InvitationService } from './invitation.service';

class CreateInvitationSuccessResponseDto extends ApiSuccessResponseDto<CreateInvitationResponseDto> {}
class InvitationSuccessResponseDto extends ApiSuccessResponseDto<InvitationResponseDto> {}
class PaginatedInvitationsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedInvitationsDto> {}
class InvitationPreviewSuccessResponseDto extends ApiSuccessResponseDto<InvitationPreviewResponseDto> {}
class AcceptInvitationSuccessResponseDto extends ApiSuccessResponseDto<
  | { newAccount: true; session: LoginResponseDto }
  | { newAccount: false; message: MessageResponseDto }
> {}

@ApiTags('Organization Invitations')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/invitations')
export class InvitationController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.invite')
  @ApiOperation({ summary: 'Invite a teammate to this organization by email' })
  @ApiOkResponse({ description: 'Invitation created', type: CreateInvitationSuccessResponseDto })
  @ApiConflictResponse({ description: 'Already a member, or a pending invitation already exists' })
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CreateInvitationDto,
  ): Promise<CreateInvitationResponseDto> {
    const { entity, token } = await this.invitationService.create(organizationId, user.id, dto);
    return CreateInvitationResponseDto.fromEntityAndLink(entity, this.buildLink(token));
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.invite')
  @ApiOperation({ summary: 'List invitations for this organization' })
  @ApiOkResponse({
    description: 'Paginated invitations',
    type: PaginatedInvitationsSuccessResponseDto,
  })
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListInvitationsQueryDto,
  ): Promise<PaginatedInvitationsDto> {
    const page = await this.invitationService.list({
      organizationId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    });
    return {
      ...page,
      items: page.items.map((item) => InvitationResponseDto.fromEntity(item)),
    };
  }

  @Post(':invitationId/resend')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.invite')
  @ApiOperation({ summary: 'Resend an invitation with a fresh token and expiration' })
  @ApiOkResponse({ description: 'Invitation resent', type: CreateInvitationSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'Invitation not found' })
  async resend(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<CreateInvitationResponseDto> {
    const { entity, token } = await this.invitationService.resend(organizationId, invitationId);
    return CreateInvitationResponseDto.fromEntityAndLink(entity, this.buildLink(token));
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.invite')
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  @ApiOkResponse({ description: 'Invitation revoked', type: InvitationSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'Invitation not found' })
  async revoke(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<InvitationResponseDto> {
    const entity = await this.invitationService.revoke(organizationId, invitationId);
    return InvitationResponseDto.fromEntity(entity);
  }

  private buildLink(token: string): string {
    const base = this.configService.get<string>(
      'invitations.acceptBaseUrl',
      'voltx://invitations/accept',
    );
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(token)}`;
  }
}

@ApiTags('Organization Invitations')
@Controller('invitations')
export class InvitationPublicController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Preview an invitation before accepting it (no auth required)' })
  @ApiOkResponse({ description: 'Invitation preview', type: InvitationPreviewSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'Invitation not found, expired, or already used' })
  async preview(@Param('token') token: string): Promise<InvitationPreviewResponseDto> {
    const entity = await this.invitationService.preview(token);
    return InvitationPreviewResponseDto.fromEntity(entity);
  }

  @Post(':token/accept')
  @ApiOperation({
    summary: 'Accept an invitation',
    description:
      'If no account exists yet for the invited email, password/firstName/lastName create one and ' +
      'log the user in immediately. If an account already exists, the membership is added and the ' +
      'user is told to sign in normally — this endpoint never bypasses an existing password.',
  })
  @ApiOkResponse({ description: 'Invitation accepted', type: AcceptInvitationSuccessResponseDto })
  @ApiNotFoundResponse({ description: 'Invitation not found, expired, or already used' })
  @ApiUnauthorizedResponse({ description: 'Missing required fields for new-account creation' })
  accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ): Promise<
    | { newAccount: true; session: LoginResponseDto }
    | { newAccount: false; message: MessageResponseDto }
  > {
    return this.invitationService.accept(token, dto);
  }
}
