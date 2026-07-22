import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ConversationService } from './conversation.service';
import { MessageResponseDto } from './dto/message-response.dto';

/**
 * Message routes (docs/routes.md — communication-service)
 *
 * GET   /messages/conversation/:conversationId  → Get messages for a conversation
 * PATCH /messages/:id/read                       → Mark message as read
 *
 * Split from ConversationController: one resource root ("messages") per controller/file.
 */
@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly conversationService: ConversationService) {}

  // Droits contextuels vérifiés dans le service (appelant doit être participant de la conversation)
  @Get('conversation/:conversationId')
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiOperation({
    summary: 'Get conversation messages',
    description: 'Returns all messages in a conversation, ordered by date. Caller must be a participant.',
  })
  @ApiResponse({ status: 200, description: 'Message list', type: [MessageResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MessageResponseDto[]> {
    const messages = await this.conversationService.getMessages(conversationId, actor.id);
    return messages.map((message) => MessageResponseDto.fromEntity(message));
  }

  // Droits contextuels vérifiés dans le service (appelant doit être participant de la conversation du message)
  @Patch(':id/read')
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiOperation({
    summary: 'Mark a message as read',
    description: 'Marks a message as read. Caller must be a participant of the conversation.',
  })
  @ApiResponse({ status: 200, description: 'Message marked as read', type: MessageResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    const message = await this.conversationService.markAsRead(id, actor.id);
    return MessageResponseDto.fromEntity(message);
  }
}
