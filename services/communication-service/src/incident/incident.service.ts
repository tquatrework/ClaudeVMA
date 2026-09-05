import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IncidentThread, IncidentStatus } from './entities/incident-thread.entity';
import { ConversationService } from '../conversation/conversation.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

/** Defensive bound on unpaginated list endpoints (see services-convention). */
const DEFAULT_LIST_LIMIT = 200;

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(IncidentThread)
    private readonly incidentThreadRepository: Repository<IncidentThread>,
    private readonly conversationService: ConversationService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Open an incident thread (COM-RA-006: TI only — enforced by JwtAuthGuard + RolesGuard
   * on IncidentController; this use case does not re-check the role).
   * Creates a dedicated conversation marked as incident=true.
   * Atomic: the conversation insert, the incident insert and the incidentId
   * back-fill all commit or roll back together under the same transaction.
   */
  async create(dto: CreateIncidentDto, actor: AuthenticatedUser): Promise<IncidentThread> {
    return this.dataSource.transaction(async (manager) => {
      // Step 1: create the backing conversation (incidentId not yet known).
      const backingConversation = await this.conversationService.createIncidentConversation(
        manager,
        [actor.id, dto.targetUserId],
        `Incident: ${dto.description.slice(0, 50)}`,
      );

      // Step 2: save the incident row referencing the conversation.
      const incidentRepository = manager.getRepository(IncidentThread);
      const newIncident = incidentRepository.create({
        conversationId: backingConversation.id,
        openedBy: actor.id,
        targetUserId: dto.targetUserId,
        description: dto.description,
        status: IncidentStatus.OPEN,
      });
      const savedIncident = await incidentRepository.save(newIncident);

      // Step 3: back-fill the incidentId into the conversation.
      await this.conversationService.setIncidentId(manager, backingConversation.id, savedIncident.id);

      return savedIncident;
    });
  }

  /**
   * Update the status of an incident thread.
   * COM-RA-006: role restriction is enforced by the controller's guards
   * (JwtAuthGuard + RolesGuard + @Roles(TECHNICIEN_INFORMATIQUE)); this
   * use case is only responsible for the resource-level invariant
   * (the incident must exist).
   */
  async updateStatus(incidentId: string, dto: UpdateIncidentStatusDto): Promise<IncidentThread> {
    const incident = await this.incidentThreadRepository.findOne({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException('Incident introuvable');

    incident.status = dto.status;
    return this.incidentThreadRepository.save(incident);
  }

  /**
   * List all incidents (TI only, enforced by controller guards).
   */
  async findAll(): Promise<IncidentThread[]> {
    return this.incidentThreadRepository.find({
      order: { createdAt: 'DESC' },
      take: DEFAULT_LIST_LIMIT,
    });
  }

  /**
   * Get a single incident by ID.
   */
  async findOne(id: string): Promise<IncidentThread> {
    const incident = await this.incidentThreadRepository.findOne({ where: { id } });
    if (!incident) throw new NotFoundException('Incident introuvable');
    return incident;
  }
}
