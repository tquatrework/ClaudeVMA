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
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
    private readonly contactService: ContactService,
  ) {}

  /**
   * List all conversations for the current user.
   */
  async findAll(userId: string): Promise<Conversation[]> {
    return this.convRepo
      .createQueryBuilder('conv')
      .where(':userId = ANY(conv.participant_ids)', { userId })
      .orderBy('conv.updated_at', 'DESC')
      .getMany();
  }

  /**
   * Create a new conversation between authorized participants.
   * COM-FB-002: all participants must be authorized contacts of the caller.
   */
  async create(dto: CreateConversationDto, callerId: string): Promise<Conversation> {
    const otherParticipants = dto.participantIds.filter((id) => id !== callerId);

    if (otherParticipants.length === 0) {
      throw new BadRequestException('A conversation must include at least one other participant');
    }

    // Check that caller has authorization to contact each participant
    for (const participantId of otherParticipants) {
      const authorized = await this.contactService.isAuthorized(callerId, participantId);
      if (!authorized) {
        throw new ForbiddenException(
          `You are not authorized to contact user ${participantId}`,
        );
      }
    }

    const allParticipants = Array.from(new Set([callerId, ...dto.participantIds]));

    const conv = this.convRepo.create({
      participantIds: allParticipants,
      subject: dto.subject,
      isIncident: false,
    });

    return this.convRepo.save(conv);
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
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException(`Conversation ${conversationId} not found`);

    if (!conv.participantIds.includes(senderId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const message = this.msgRepo.create({
      conversationId,
      senderId,
      content: dto.content,
      attachmentRef: dto.attachmentRef,
      isSystem: false,
    });

    const saved = await this.msgRepo.save(message);

    // Update conversation timestamp
    await this.convRepo.save({ ...conv, updatedAt: new Date() });

    return saved;
  }

  /**
   * Get all messages for a conversation.
   * The caller must be a participant.
   */
  async getMessages(conversationId: string, callerId: string): Promise<Message[]> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException(`Conversation ${conversationId} not found`);

    if (!conv.participantIds.includes(callerId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    return this.msgRepo.find({
      where: { conversationId },
      order: { sentAt: 'ASC' },
    });
  }

  /**
   * Mark a message as read.
   * COM-BR-008: the message is accessible to all conversation participants.
   */
  async markAsRead(messageId: string, callerId: string): Promise<Message> {
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException(`Message ${messageId} not found`);

    const conv = await this.convRepo.findOne({ where: { id: msg.conversationId } });
    if (!conv || !conv.participantIds.includes(callerId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    msg.isRead = true;
    return this.msgRepo.save(msg);
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
    const conv = this.convRepo.create({
      participantIds,
      subject,
      isIncident: true,
      incidentId: incidentId || null,
    });
    return this.convRepo.save(conv);
  }

  /**
   * Back-fill the incidentId into an incident conversation once the incident row is created.
   */
  async setIncidentId(conversationId: string, incidentId: string): Promise<void> {
    await this.convRepo.update({ id: conversationId }, { incidentId });
  }
}
