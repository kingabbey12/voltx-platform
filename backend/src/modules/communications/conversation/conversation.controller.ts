import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { ConversationService } from './conversation.service';
import {
  ConversationResponseDto,
  ConversationSuccessResponseDto,
  CreateNoteDto,
  ListConversationsQueryDto,
  MessageResponseDto,
  MessageSuccessResponseDto,
  NoteResponseDto,
  NoteSuccessResponseDto,
  NotesListSuccessResponseDto,
  PaginatedConversationsSuccessResponseDto,
  PaginatedMessagesSuccessResponseDto,
  SendMessageDto,
  UpdateConversationDto,
} from './dto/conversation.dto';

@ApiTags('Communications')
@ApiBearerAuth('JWT')
@Controller('communications/conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.read')
  @ApiOperation({ summary: 'List conversations in the unified inbox' })
  @ApiOkResponse({ type: PaginatedConversationsSuccessResponseDto })
  async list(@Query() query: ListConversationsQueryDto) {
    const result = await this.conversationService.listConversations({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      status: query.status as never,
      unread: query.unread,
      assigneeId: query.assigneeId,
      priority: query.priority as never,
    });
    return {
      ...result,
      items: result.items.map((item) => ConversationResponseDto.fromEntity(item)),
    };
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.read')
  @ApiOperation({ summary: 'Get a conversation' })
  @ApiOkResponse({ type: ConversationSuccessResponseDto })
  async getById(@Param('id') id: string): Promise<ConversationResponseDto> {
    const conversation = await this.conversationService.getConversationOrThrow(id);
    return ConversationResponseDto.fromEntity(conversation);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.update')
  @ApiOperation({ summary: 'Assign, archive, pin, prioritize, or mark a conversation read/unread' })
  @ApiOkResponse({ type: ConversationSuccessResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.conversationService.updateConversation(id, dto as never);
    return ConversationResponseDto.fromEntity(conversation);
  }

  @Get(':id/messages')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.read')
  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiOkResponse({ type: PaginatedMessagesSuccessResponseDto })
  async listMessages(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.conversationService.listMessages(id, page ?? 1, limit ?? 50);
    return {
      items: result.items.map((item) => MessageResponseDto.fromEntity(item)),
      total: result.total,
    };
  }

  @Post(':id/messages')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.message.create')
  @ApiOperation({
    summary: "Send a real message through the conversation's channel — never simulated",
  })
  @ApiCreatedResponse({ type: MessageSuccessResponseDto })
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<MessageResponseDto> {
    const message = await this.conversationService.sendMessage({
      conversationId: id,
      body: dto.body,
      senderId: user.id,
      attachmentIds: dto.attachmentIds,
    });
    return MessageResponseDto.fromEntity(message);
  }

  @Get(':id/notes')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.read')
  @ApiOperation({ summary: 'List internal, agent-only notes on a conversation' })
  @ApiOkResponse({ type: NotesListSuccessResponseDto })
  async listNotes(@Param('id') id: string): Promise<NoteResponseDto[]> {
    const notes = await this.conversationService.listNotes(id);
    return notes.map((note) => NoteResponseDto.fromEntity(note));
  }

  @Post(':id/notes')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.note.create')
  @ApiOperation({ summary: 'Add an internal, agent-only note — never sent through the channel' })
  @ApiCreatedResponse({ type: NoteSuccessResponseDto })
  async addNote(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<NoteResponseDto> {
    const note = await this.conversationService.addNote(id, user.id, dto.body);
    return NoteResponseDto.fromEntity(note);
  }
}
