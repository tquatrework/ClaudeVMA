import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class CommunicationService {
  constructor(
    @InjectRepository(Message) private readonly repo: Repository<Message>,
  ) {}

  send(dto: SendMessageDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findByConversation(conversationId: string) {
    return this.repo.find({ where: { conversationId }, order: { sentAt: 'ASC' } });
  }

  async markAsRead(id: string) {
    const msg = await this.repo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException(`Message ${id} not found`);
    return this.repo.save({ ...msg, isRead: true });
  }
}
