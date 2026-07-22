import {
  Controller,
  Get,
  Post,
  Body,
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
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';

/**
 * Conversation routes (docs/routes.md — communication-service)
 *
 * GET  /conversations                            → List user's conversations
 * POST /conversations                            → Create a conversation (COM-BR-010, COM-FB-002)
 * POST /conversations/:id/messages               → Send a message (nested creation on the conversation resource)
 *
 * Message-rooted routes (GET /messages/conversation/:id, PATCH /messages/:id/read)
 * live in MessageController — one resource root per controller.
 */
@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  // Droits contextuels vérifiés dans le service (appartenance à la liste des conversations du userId courant)
  @Get()
  @ApiOperation({
    summary: 'List my conversations',
    description:
      'Returns all conversations the current user participates in, ordered by last activity.',
  })
  @ApiResponse({ status: 200, description: 'Conversation list', type: [ConversationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listConversations(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ConversationResponseDto[]> {
    const conversations = await this.conversationService.findAll(actor.id);
    return conversations.map((conversation) => ConversationResponseDto.fromEntity(conversation));
  }

  // Droits contextuels vérifiés dans le service (contact autorisé via ContactService.isAuthorized — COM-BR-010, COM-FB-002)
  @Post()
  @ApiOperation({
    summary: 'Create a conversation',
    description:
      'Creates a new conversation between the caller and the listed participants. ' +
      'COM-BR-010: all participants must be in the caller\'s authorized contact list. ' +
      'COM-FB-002: unauthorized contacts will be rejected with 403.',
  })
  @ApiResponse({ status: 201, description: 'Conversation created', type: ConversationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or no other participant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Contact not authorized — COM-FB-002' })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.conversationService.create(dto, actor.id);
    return ConversationResponseDto.fromEntity(conversation);
  }

  // Droits contextuels vérifiés dans le service (appelant doit être participant de la conversation)
  @Post(':conversationId/messages')
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Send a message in an existing conversation. The caller must be a participant. ' +
      'COM-BR-008: a sent message cannot be deleted or edited.',
  })
  @ApiResponse({ status: 201, description: 'Message sent', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async sendMessage(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    const message = await this.conversationService.sendMessage(conversationId, dto, actor.id);
    return MessageResponseDto.fromEntity(message);
  }
}
