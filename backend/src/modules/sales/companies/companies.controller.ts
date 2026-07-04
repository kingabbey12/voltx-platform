import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import {
  CompanyResponseDto,
  CompanySuccessResponseDto,
  CreateCompanyDto,
  ListCompaniesQueryDto,
  PaginatedCompaniesDto,
  PaginatedCompaniesSuccessResponseDto,
  UpdateCompanyDto,
} from './dto/company.dto';
import { CompaniesService } from './companies.service';

@ApiTags('Sales Companies')
@ApiBearerAuth('JWT')
@Controller('sales/companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.company.create')
  @ApiOperation({ summary: 'Create a sales company' })
  @ApiCreatedResponse({ type: CompanySuccessResponseDto })
  create(@Body() dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    return this.companiesService.create(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.company.read')
  @ApiOperation({ summary: 'List sales companies' })
  @ApiOkResponse({ type: PaginatedCompaniesSuccessResponseDto })
  findAll(@Query() query: ListCompaniesQueryDto): Promise<PaginatedCompaniesDto> {
    return this.companiesService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      status: query.status,
    });
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.company.read')
  @ApiOperation({ summary: 'Get a sales company by id' })
  @ApiOkResponse({ type: CompanySuccessResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyResponseDto> {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.company.update')
  @ApiOperation({ summary: 'Update a sales company' })
  @ApiOkResponse({ type: CompanySuccessResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.company.delete')
  @ApiOperation({ summary: 'Soft delete a sales company' })
  @ApiOkResponse({ type: CompanySuccessResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyResponseDto> {
    return this.companiesService.remove(id);
  }
}
