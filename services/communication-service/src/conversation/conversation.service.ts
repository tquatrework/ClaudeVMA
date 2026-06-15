import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ContactService } from '../contact/contact.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly contactService: ContactService,
  ) {}

  /**
   * List all conversations for the current user.
   */
  async findAll(userId: string): Promise<Conversation[]> {
    return this.conversationRepository
      .createQueryBuilder('conversation')
      .where(':userId = ANY(conversation.participant_ids)', { userId })
      .orderBy('conversation.updated_at', 'DESC')
      .getMany();
  }

  /**
   * Create a new conversation between authorized participants.
   * COM-FB-002: all participants must be authorized contacts of the caller.
   */
  async create(dto: CreateConversationDto, callerId: string): Promise<Conversation> {
    const otherParticipants = dto.participantIds.filter((participantId) => participantId !== callerId);

    if (otherParticipants.length === 0) {
      throw new BadRequestException('A conversation must include at least one other participant');
    }

    // Check that caller has authorization to contact each participant
    for (const participantId of otherParticipants) {
      const isContactAuthorized = await this.contactService.isAuthorized(callerId, participantId);
      if (!isContactAuthorized) {
        throw new ForbiddenException(
          `You are not authorized to contact user ${participantId}`,
        );
      }
    }

    const allParticipants = Array.from(new Set([callerId, ...dto.participantIds]));

    const newConversation = this.conversationRepository.create({
      participantIds: allParticipants,
      subject: dto.subject,
      isIncident: false,
    });

    return this.conversationRepository.save(newConversation);
  }

  /**
   * Send a message in an existing conversation.
   * The sender must be a participant in the conversation.
   */
  async sendMessage(
    conversationId: string,
    dto: SendMessageDto,
    senderId: string,
  ): Promise<Message> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException(`Conversation ${conversationId} not found`);

    if (!conversation.participantIds.includes(senderId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const newMessage = this.messageRepository.create({
      conversationId,
      senderId,
      content: dto.content,
      attachmentRef: dto.attachmentRef,
      isSystem: false,
    });

    const savedMessage = await this.messageRepository.save(newMessage);

    // Update conversation timestamp
    await this.conversationRepository.save({ ...conversation, updatedAt: new Date() });

    return savedMessage;
  }

  /**
   * Get all messages for a conversation.
   * The caller must be a participant.
   */
  async getMessages(conversationId: string, callerId: string): Promise<Message[]> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException(`Conversation ${conversationId} not found`);

    if (!conversation.participantIds.includes(callerId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    return this.messageRepository.find({
      where: { conversationId },
      order: { sentAt: 'ASC' },
    });
  }

  /**
   * Mark a message as read.
   * COM-BR-008: the message is accessible to all conversation participants.
   */
  async markAsRead(messageId: string, callerId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    const conversation = await this.conversationRepository.findOne({ where: { id: message.conversationId } });
    if (!conversation || !conversation.participantIds.includes(callerId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    message.isRead = true;
    return this.messageRepository.save(message);
  }

  /**
   * Create a conversation for an incident thread (TI usage, isIncident=true).
   * Used internally by the incident service.
   */
  async createIncidentConversation(
    participantIds: string[],
    subject: string,
    incidentId: string,
  ): Promise<Conversation> {
    const newConversation = this.conversationRepository.create({
      participantIds,
      subject,
      isIncident: true,
      incidentId: incidentId || null,
    });
    return this.conversationRepository.save(newConversation);
  }

  /**
   * Back-fill the incidentId into an incident conversation once the incident row is created.
   */
  async setIncidentId(conversationId: string, incidentId: string): Promise<void> {
    await this.conversationRepository.update({ id: conversationId }, { incidentId });
  }
}
