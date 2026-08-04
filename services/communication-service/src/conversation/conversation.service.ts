import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ContactService } from '../contact/contact.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

/** Defensive bound on unpaginated list endpoints (see services-convention). */
const DEFAULT_LIST_LIMIT = 200;
const DEFAULT_MESSAGE_LIST_LIMIT = 500;

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly contactService: ContactService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * List all conversations for the calling actor.
   */
  async findAll(actor: AuthenticatedUser): Promise<Conversation[]> {
    return this.conversationRepository
      .createQueryBuilder('conversation')
      .where(':userId = ANY(conversation.participant_ids)', { userId: actor.id })
      .orderBy('conversation.updated_at', 'DESC')
      .take(DEFAULT_LIST_LIMIT)
      .getMany();
  }

  /**
   * Create a new conversation between authorized participants.
   * COM-FB-002: all participants must be authorized contacts of the caller.
   */
  async create(dto: CreateConversationDto, actor: AuthenticatedUser): Promise<Conversation> {
    const otherParticipants = dto.participantIds.filter((participantId) => participantId !== actor.id);

    if (otherParticipants.length === 0) {
      throw new BadRequestException('A conversation must include at least one other participant');
    }

    // Single batched authorization check (avoids one query per participant — N+1).
    const unauthorizedParticipants = await this.contactService.findUnauthorizedContacts(
      actor.id,
      otherParticipants,
    );
    if (unauthorizedParticipants.length > 0) {
      throw new ForbiddenException(
        `You are not authorized to contact user ${unauthorizedParticipants[0]}`,
      );
    }

    const allParticipants = Array.from(new Set([actor.id, ...dto.participantIds]));

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
   * Atomic: the message insert and the conversation's `updatedAt` bump
   * happen under the same transaction/EntityManager.
   */
  async sendMessage(
    conversationId: string,
    dto: SendMessageDto,
    actor: AuthenticatedUser,
  ): Promise<Message> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException(`Conversation ${conversationId} not found`);

    if (!conversation.participantIds.includes(actor.id)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    return this.dataSource.transaction(async (manager) => {
      const messageRepository = manager.getRepository(Message);
      const conversationRepository = manager.getRepository(Conversation);

      const newMessage = messageRepository.create({
        conversationId,
        senderId: actor.id,
        content: dto.content,
        attachmentRef: dto.attachmentRef,
        isSystem: false,
      });
      const savedMessage = await messageRepository.save(newMessage);

      await conversationRepository.update({ id: conversationId }, { updatedAt: new Date() });

      return savedMessage;
    });
  }

  /**
   * Get all messages for a conversation.
   * The caller must be a participant.
   */
  async getMessages(conversationId: string, actor: AuthenticatedUser): Promise<Message[]> {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException(`Conversation ${conversationId} not found`);

    if (!conversation.participantIds.includes(actor.id)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    return this.messageRepository.find({
      where: { conversationId },
      order: { sentAt: 'ASC' },
      take: DEFAULT_MESSAGE_LIST_LIMIT,
    });
  }

  /**
   * Mark a message as read.
   * COM-BR-008: the message is accessible to all conversation participants.
   */
  async markAsRead(messageId: string, actor: AuthenticatedUser): Promise<Message> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    const conversation = await this.conversationRepository.findOne({ where: { id: message.conversationId } });
    if (!conversation || !conversation.participantIds.includes(actor.id)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    message.isRead = true;
    return this.messageRepository.save(message);
  }

  /**
   * Create the backing conversation for an incident thread (isIncident=true).
   * Used exclusively by IncidentService.create, which owns the surrounding
   * transaction: this method never opens its own transaction, it always
   * writes through the EntityManager supplied by the caller so that the
   * conversation row and the incident row commit or roll back together.
   */
  async createIncidentConversation(
    manager: EntityManager,
    participantIds: string[],
    subject: string,
  ): Promise<Conversation> {
    const conversationRepository = manager.getRepository(Conversation);
    const newConversation = conversationRepository.create({
      participantIds,
      subject,
      isIncident: true,
      incidentId: null,
    });
    return conversationRepository.save(newConversation);
  }

  /**
   * Back-fill the incidentId into an incident conversation once the incident row is created.
   * Must run on the same EntityManager/transaction as `createIncidentConversation` and the
   * IncidentThread insert (see IncidentService.create).
   */
  async setIncidentId(manager: EntityManager, conversationId: string, incidentId: string): Promise<void> {
    await manager.getRepository(Conversation).update({ id: conversationId }, { incidentId });
  }
}
