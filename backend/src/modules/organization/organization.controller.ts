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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
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
  @ApiOperation({ summary: 'List organizations' })
  @ApiOkResponse({
    description: 'Paginated list of organizations',
    type: PaginatedOrganizationsSuccessResponseDto,
  })
  findAll(@Query() query: ListOrganizationsQueryDto): Promise<PaginatedOrganizationsDto> {
    return this.organizationService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiOkResponse({
    description: 'Organization details',
    type: OrganizationSuccessResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrganizationResponseDto> {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization' })
  @ApiOkResponse({
    description: 'Organization updated successfully',
    type: OrganizationSuccessResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete an organization' })
  @ApiOkResponse({
    description: 'Organization soft deleted successfully',
    type: OrganizationSuccessResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<OrganizationResponseDto> {
    return this.organizationService.remove(id);
  }
}
