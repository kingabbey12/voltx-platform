import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScimTokenGuard } from './guards/scim-token.guard';
import { ScimAuthenticatedRequest } from './interfaces/scim-request.interface';
import { ScimGroupsService } from './scim-groups.service';
import { ScimUsersService } from './scim-users.service';
import {
  ScimGroupResource,
  ScimListResponse,
  ScimPatchOpRequest,
  ScimUserResource,
} from './dto/scim-wire.types';

function requireScimContext(request: ScimAuthenticatedRequest): {
  organizationId: string;
  scimTokenId: string;
} {
  if (!request.scimContext) {
    throw new Error('ScimTokenGuard did not populate scimContext');
  }
  return request.scimContext;
}

@ApiTags('SCIM')
@UseGuards(ScimTokenGuard)
@Controller('scim/v2/Users')
export class ScimUsersController {
  constructor(private readonly scimUsersService: ScimUsersService) {}

  @Get()
  @ApiOperation({ summary: 'SCIM: list/filter users' })
  async list(
    @Req() request: ScimAuthenticatedRequest,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ): Promise<ScimListResponse<ScimUserResource>> {
    const { organizationId, scimTokenId } = requireScimContext(request);
    return this.scimUsersService.list(organizationId, scimTokenId, {
      filter,
      startIndex: startIndex ? Number.parseInt(startIndex, 10) : 1,
      count: count ? Number.parseInt(count, 10) : 100,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'SCIM: get one user' })
  async getOne(
    @Req() request: ScimAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ScimUserResource> {
    const { organizationId } = requireScimContext(request);
    return this.scimUsersService.getById(organizationId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'SCIM: create (provision) a user' })
  async create(
    @Req() request: ScimAuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ): Promise<ScimUserResource> {
    const { organizationId, scimTokenId } = requireScimContext(request);
    return this.scimUsersService.create(organizationId, scimTokenId, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'SCIM: replace a user' })
  async replace(
    @Req() request: ScimAuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<ScimUserResource> {
    const { organizationId, scimTokenId } = requireScimContext(request);
    return this.scimUsersService.replace(organizationId, scimTokenId, id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'SCIM: partially update a user (typically deactivation)' })
  async patch(
    @Req() request: ScimAuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: ScimPatchOpRequest,
  ): Promise<ScimUserResource> {
    const { organizationId, scimTokenId } = requireScimContext(request);
    return this.scimUsersService.patch(organizationId, scimTokenId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'SCIM: deactivate a user (never deletes the underlying account)' })
  async remove(@Req() request: ScimAuthenticatedRequest, @Param('id') id: string): Promise<void> {
    const { organizationId, scimTokenId } = requireScimContext(request);
    await this.scimUsersService.remove(organizationId, scimTokenId, id);
  }
}

@ApiTags('SCIM')
@UseGuards(ScimTokenGuard)
@Controller('scim/v2/Groups')
export class ScimGroupsController {
  constructor(private readonly scimGroupsService: ScimGroupsService) {}

  @Get()
  @ApiOperation({ summary: 'SCIM: list groups (Voltx roles projected as SCIM groups)' })
  async list(
    @Req() request: ScimAuthenticatedRequest,
  ): Promise<ScimListResponse<ScimGroupResource>> {
    const { organizationId } = requireScimContext(request);
    return this.scimGroupsService.list(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'SCIM: get one group' })
  async getOne(
    @Req() request: ScimAuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ScimGroupResource> {
    const { organizationId } = requireScimContext(request);
    return this.scimGroupsService.getById(organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'SCIM: add/remove group members (reassigns the Voltx role)' })
  async patch(
    @Req() request: ScimAuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: ScimPatchOpRequest,
  ): Promise<ScimGroupResource> {
    const { organizationId, scimTokenId } = requireScimContext(request);
    return this.scimGroupsService.patch(organizationId, scimTokenId, id, body);
  }
}
