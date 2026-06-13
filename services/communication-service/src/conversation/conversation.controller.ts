import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * Conversation routes (docs/routes.md — communication-service)
 *
 * GET  /conversations                            → List user's conversations
 * POST /conversations                            → Create a conversation (COM-BR-010, COM-FB-002)
 * POST /conversations/:id/messages              → Send a message
 * GET  /messages/conversation/:id               → Get messages for a conversation
 * PATCH /messages/:id/read                       → Mark message as read
 */
@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  // ── Conversations ──────────────────────────────────────────────────────────

  @Get('conversations')
  @ApiOperation({
    summary: 'List my conversations',
    description:
      'Returns all conversations the current user participates in, ordered by last activity.',
  })
  @ApiResponse({ status: 200, description: 'Conversation list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  listConversations(@Req() req: any) {
    return this.conversationService.findAll(req.user.id);
  }

  @Post('conversations')
  @ApiOperation({
    summary: 'Create a conversation',
    description:
      'Creates a new conversation between the caller and the listed participants. ' +
      'COM-BR-010: all participants must be in the caller\'s authorized contact list. ' +
      'COM-FB-002: unauthorized contacts will be rejected with 403.',
  })
  @ApiResponse({ status: 201, description: 'Conversation created' })
  @ApiResponse({ status: 400, description: 'Validation error or no other participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Contact not authorized — COM-FB-002' })
  createConversation(@Body() dto: CreateConversationDto, @Req() req: any) {
    return this.conversationService.create(dto, req.user.id);
  }

  @Post('conversations/:conversationId/messages')
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Send a message in an existing conversation. The caller must be a participant. ' +
      'COM-BR-008: a sent message cannot be deleted or edited.',
  })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
    @Req() req: any,
  ) {
    return this.conversationService.sendMessage(conversationId, dto, req.user.id);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  @Get('messages/conversation/:conversationId')
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiOperation({
    summary: 'Get conversation messages',
    description: 'Returns all messages in a conversation, ordered by date. Caller must be a participant.',
  })
  @ApiResponse({ status: 200, description: 'Message list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  getMessages(
    @Param('conversationId') conversationId: string,
    @Req() req: any,
  ) {
    return this.conversationService.getMessages(conversationId, req.user.id);
  }

  @Patch('messages/:id/read')
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiOperation({
    summary: 'Mark a message as read',
    description: 'Marks a message as read. Caller must be a participant of the conversation.',
  })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.conversationService.markAsRead(id, req.user.id);
  }
}
