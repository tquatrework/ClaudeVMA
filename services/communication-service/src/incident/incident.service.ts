import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentThread, IncidentStatus } from './entities/incident-thread.entity';
import { ConversationService } from '../conversation/conversation.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(IncidentThread)
    private readonly incidentThreadRepository: Repository<IncidentThread>,
    private readonly conversationService: ConversationService,
  ) {}

  /**
   * Open an incident thread (COM-RA-006: TI only).
   * Creates a dedicated conversation marked as incident=true.
   * The incidentId is stored in the conversation after the incident row is created.
   */
  async create(dto: CreateIncidentDto, openedBy: string): Promise<IncidentThread> {
    // Step 1: create a preliminary backing conversation (incidentId not yet known)
    const backingConversation = await this.conversationService.createIncidentConversation(
      [openedBy, dto.targetUserId],
      `Incident: ${dto.description.slice(0, 50)}`,
      '', // placeholder — updated below
    );

    // Step 2: save the incident row referencing the conversation
    const newIncident = this.incidentThreadRepository.create({
      conversationId: backingConversation.id,
      openedBy,
      targetUserId: dto.targetUserId,
      description: dto.description,
      status: IncidentStatus.OPEN,
    });

    const savedIncident = await this.incidentThreadRepository.save(newIncident);

    // Step 3: back-fill the incidentId into the conversation
    await this.conversationService.setIncidentId(backingConversation.id, savedIncident.id);

    return savedIncident;
  }

  /**
   * Update the status of an incident thread.
   * COM-RA-006: TI can manage incident threads.
   */
  async updateStatus(
    incidentId: string,
    dto: UpdateIncidentStatusDto,
    callerId: string,
    callerRole: string,
  ): Promise<IncidentThread> {
    const incident = await this.incidentThreadRepository.findOne({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException(`Incident ${incidentId} not found`);

    if (callerRole !== 'technicien_informatique') {
      throw new ForbiddenException('Only TI can update incident status');
    }

    incident.status = dto.status;
    return this.incidentThreadRepository.save(incident);
  }

  /**
   * List all incidents (TI only).
   */
  async findAll(): Promise<IncidentThread[]> {
    return this.incidentThreadRepository.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Get a single incident by ID.
   */
  async findOne(id: string): Promise<IncidentThread> {
    const incident = await this.incidentThreadRepository.findOne({ where: { id } });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }
}
