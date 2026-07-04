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
import { SalesAiActionDto, SalesAiActionResponseDto } from '../dto/sales-ai.dto';
import {
  ContactResponseDto,
  ContactSuccessResponseDto,
  CreateContactDto,
  DraftEmailSuccessResponseDto,
  ListContactsQueryDto,
  PaginatedContactsDto,
  PaginatedContactsSuccessResponseDto,
  UpdateContactDto,
} from './dto/contact.dto';
import { ContactsService } from './contacts.service';

@ApiTags('Sales Contacts')
@ApiBearerAuth('JWT')
@Controller('sales/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.contact.create')
  @ApiOperation({ summary: 'Create a sales contact' })
  @ApiCreatedResponse({ type: ContactSuccessResponseDto })
  create(@Body() dto: CreateContactDto): Promise<ContactResponseDto> {
    return this.contactsService.create(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.contact.read')
  @ApiOperation({ summary: 'List sales contacts' })
  @ApiOkResponse({ type: PaginatedContactsSuccessResponseDto })
  findAll(@Query() query: ListContactsQueryDto): Promise<PaginatedContactsDto> {
    return this.contactsService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      companyId: query.companyId,
    });
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.contact.read')
  @ApiOperation({ summary: 'Get a sales contact by id' })
  @ApiOkResponse({ type: ContactSuccessResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ContactResponseDto> {
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.contact.update')
  @ApiOperation({ summary: 'Update a sales contact' })
  @ApiOkResponse({ type: ContactSuccessResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.contact.delete')
  @ApiOperation({ summary: 'Soft delete a sales contact' })
  @ApiOkResponse({ type: ContactSuccessResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<ContactResponseDto> {
    return this.contactsService.remove(id);
  }

  @Post(':id/draft-email')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.ai.run')
  @ApiOperation({ summary: 'Draft an AI sales email for a contact' })
  @ApiOkResponse({ type: DraftEmailSuccessResponseDto })
  draftEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SalesAiActionDto,
  ): Promise<SalesAiActionResponseDto> {
    return this.contactsService.draftEmail(id, dto);
  }
}
