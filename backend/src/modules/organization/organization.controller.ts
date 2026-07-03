import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import {
  ListOrganizationsQueryDto,
  OrganizationResponseDto,
  PaginatedOrganizationsDto,
} from './dto/organization-response.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationService } from './organization.service';

class OrganizationSuccessResponseDto extends ApiSuccessResponseDto<OrganizationResponseDto> {}

class PaginatedOrganizationsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedOrganizationsDto> {}

@ApiTags('Organizations')
@ApiBearerAuth('JWT')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new organization',
    description: 'Creates an organization and auto-generates a unique slug from the name.',
  })
  @ApiCreatedResponse({
    description: 'Organization created successfully with an auto-generated slug',
    type: OrganizationSuccessResponseDto,
  })
  @ApiConflictResponse({ description: 'Organization slug conflict during concurrent create' })
  create(@Body() dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    return this.organizationService.create(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.read')
  @ApiOperation({ summary: 'List organizations' })
  @ApiOkResponse({
    description: 'Paginated list of organizations',
    type: PaginatedOrganizationsSuccessResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findAll(@Query() query: ListOrganizationsQueryDto): Promise<PaginatedOrganizationsDto> {
    return this.organizationService.findAll(query);
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.read')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiOkResponse({
    description: 'Organization details',
    type: OrganizationSuccessResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrganizationResponseDto> {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.update')
  @ApiOperation({ summary: 'Update an organization' })
  @ApiOkResponse({
    description: 'Organization updated successfully',
    type: OrganizationSuccessResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('organization.delete')
  @ApiOperation({ summary: 'Soft delete an organization' })
  @ApiOkResponse({
    description: 'Organization soft deleted successfully',
    type: OrganizationSuccessResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<OrganizationResponseDto> {
    return this.organizationService.remove(id);
  }
}
