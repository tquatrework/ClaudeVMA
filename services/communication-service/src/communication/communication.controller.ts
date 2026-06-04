import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class CommunicationController {
  constructor(private readonly service: CommunicationService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message', description: 'Send a text message within a conversation' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  send(@Body() dto: SendMessageDto) {
    return this.service.send(dto);
  }

  @Get('conversation/:conversationId')
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiOperation({ summary: 'Get conversation messages', description: 'Returns all messages for a conversation, ordered by date' })
  @ApiResponse({ status: 200, description: 'Message list' })
  getConversation(@Param('conversationId') conversationId: string) {
    return this.service.findByConversation(conversationId);
  }

  @Patch(':id/read')
  @ApiParam({ name: 'id', description: 'Message UUID' })
  @ApiOperation({ summary: 'Mark message as read' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  markAsRead(@Param('id') id: string) {
    return this.service.markAsRead(id);
  }
}
