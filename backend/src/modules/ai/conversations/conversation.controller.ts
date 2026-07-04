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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { ConversationService } from './conversation.service';
import {
  ConversationSuccessResponseDto,
  CreateConversationDto,
  CreateConversationMessageResponseDto,
  CreateConversationMessageSuccessResponseDto,
  CreateMessageDto,
  ListConversationsQueryDto,
  ListMessagesQueryDto,
  PaginatedConversationsDto,
  PaginatedConversationsSuccessResponseDto,
  PaginatedMessagesDto,
  PaginatedMessagesSuccessResponseDto,
  UpdateConversationDto,
} from './dto/conversation.dto';

@ApiTags('AI Conversations')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS)
@Controller('ai/conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new AI conversation' })
  @ApiOkResponse({ type: ConversationSuccessResponseDto })
  create(@Body() dto: CreateConversationDto) {
    return this.conversationService.createConversation(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List AI conversations' })
  @ApiOkResponse({ type: PaginatedConversationsSuccessResponseDto })
  findAll(@Query() query: ListConversationsQueryDto): Promise<PaginatedConversationsDto> {
    return this.conversationService.listConversations({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      pinned: query.pinned,
      archived: query.archived,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an AI conversation by id' })
  @ApiOkResponse({ type: ConversationSuccessResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationService.getConversation(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an AI conversation' })
  @ApiOkResponse({ type: ConversationSuccessResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConversationDto) {
    return this.conversationService.updateConversation(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete an AI conversation' })
  @ApiOkResponse({ type: ConversationSuccessResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationService.deleteConversation(id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Create a user message and generate an assistant response' })
  @ApiOkResponse({ type: CreateConversationMessageSuccessResponseDto })
  createMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<CreateConversationMessageResponseDto> {
    return this.conversationService.createMessage(id, dto);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List messages for an AI conversation' })
  @ApiOkResponse({ type: PaginatedMessagesSuccessResponseDto })
  findMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<PaginatedMessagesDto> {
    return this.conversationService.listMessages(id, {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }
}
