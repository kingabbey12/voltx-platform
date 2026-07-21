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
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreatePromiseDto,
  ListPromisesQueryDto,
  PaginatedPromisesDto,
  PromiseEventResponseDto,
  PromiseResponseDto,
  TransitionPromiseDto,
  UpdatePromiseDto,
} from './dto/promise.dto';
import { PromisesService } from './promises.service';

@ApiTags('Promises')
@ApiBearerAuth('JWT')
@Controller('promises')
export class PromisesController {
  constructor(private readonly promisesService: PromisesService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.create')
  @ApiOperation({ summary: 'Propose a promise' })
  @ApiCreatedResponse({ description: 'The created promise' })
  create(
    @Body() dto: CreatePromiseDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<PromiseResponseDto> {
    return this.promisesService.create(dto, user.id);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.read')
  @ApiOperation({ summary: 'List promises, grouped by status client-side' })
  @ApiOkResponse({ description: 'Paginated promises' })
  findAll(@Query() query: ListPromisesQueryDto): Promise<PaginatedPromisesDto> {
    return this.promisesService.findAll(query);
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.read')
  @ApiOperation({ summary: 'Get a promise by id — the canonical promise record' })
  @ApiOkResponse({ description: 'The promise' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PromiseResponseDto> {
    return this.promisesService.findOne(id);
  }

  @Get(':id/events')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.read')
  @ApiOperation({ summary: "A promise's append-only event log (creation, changes, completion)" })
  @ApiOkResponse({ description: 'The promise event log' })
  getEvents(@Param('id', ParseUUIDPipe) id: string): Promise<PromiseEventResponseDto[]> {
    return this.promisesService.getEvents(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.update')
  @ApiOperation({ summary: 'Update a promise (title, owner, due date)' })
  @ApiOkResponse({ description: 'The updated promise' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromiseDto,
  ): Promise<PromiseResponseDto> {
    return this.promisesService.update(id, dto);
  }

  @Post(':id/stand')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.update')
  @ApiOperation({ summary: 'Move a proposed promise to standing' })
  @ApiOkResponse({ description: 'The updated promise' })
  stand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionPromiseDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<PromiseResponseDto> {
    return this.promisesService.transition(id, 'stand', dto, user.id);
  }

  @Post(':id/fulfill')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.update')
  @ApiOperation({ summary: 'Mark a standing promise as fulfilled (kept)' })
  @ApiOkResponse({ description: 'The updated promise' })
  fulfill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionPromiseDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<PromiseResponseDto> {
    return this.promisesService.transition(id, 'fulfill', dto, user.id);
  }

  @Post(':id/release')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.update')
  @ApiOperation({ summary: 'Release a proposed or standing promise' })
  @ApiOkResponse({ description: 'The updated promise' })
  release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionPromiseDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<PromiseResponseDto> {
    return this.promisesService.transition(id, 'release', dto, user.id);
  }

  @Post(':id/break')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.update')
  @ApiOperation({ summary: 'Mark a standing promise as broken' })
  @ApiOkResponse({ description: 'The updated promise' })
  break(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionPromiseDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<PromiseResponseDto> {
    return this.promisesService.transition(id, 'break', dto, user.id);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('promise.delete')
  @ApiOperation({ summary: 'Soft delete a promise' })
  @ApiOkResponse({ description: 'The deleted promise' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<PromiseResponseDto> {
    return this.promisesService.remove(id);
  }
}
