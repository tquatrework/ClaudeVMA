import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Tutorial } from './entities/tutorial.entity';
import { CreateTutorialDto } from './dto/create-tutorial.dto';
import { SearchTutorialDto } from './dto/search-tutorial.dto';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Rôles à lecture non restreinte sur un tutoriel non validé (arbitrage du
 * 2026-09-02, "Visibilité du contenu en attente de validation, pour son
 * validateur (RP/AP)"). Contrairement au Quizz/Exercice/Évaluation,
 * la décision de validation d'un Tutoriel n'est PAS scopée par relation
 * animator_of_teacher (arbitrage du 2026-08-29, resté explicitement hors
 * périmètre pour ce type) — la lecture suit donc la même règle non scopée
 * ("qui peut décider doit pouvoir voir"), pas un scoping introduit à part.
 */
const ADMIN_ROLES = [
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

@Injectable()
export class TutorialsService {
  constructor(
    @InjectRepository(Tutorial)
    private readonly tutorialRepository: Repository<Tutorial>,
  ) {}

  private isAdminRole(role: string): boolean {
    return ADMIN_ROLES.includes(role as UserRole);
  }

  async search(
    searchParams: SearchTutorialDto,
    callerRole: string,
  ): Promise<{ items: Tutorial[]; total: number }> {
    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause: FindOptionsWhere<Tutorial> = {};

    if (callerRole === UserRole.PARENT_FINANCEUR || callerRole === UserRole.ELEVE) {
      whereClause.status = ContentStatus.VALIDATED;
    }

    if (searchParams.level) whereClause.level = searchParams.level;
    if (searchParams.theme) whereClause.theme = searchParams.theme;
    if (searchParams.tutorialType) whereClause.tutorialType = searchParams.tutorialType;
    if (searchParams.format) whereClause.format = searchParams.format;

    const [items, total] = await this.tutorialRepository.findAndCount({
      where: whereClause,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async create(
    createTutorialDto: CreateTutorialDto,
    authorId: string,
    authorRole: string,
  ): Promise<Tutorial> {
    const allowedUploaderRoles = [
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    ];
    if (!allowedUploaderRoles.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs et rôles pédagogiques peuvent charger des tutoriels');
    }

    const tutorial = this.tutorialRepository.create({
      ...createTutorialDto,
      authorId,
      authorRole,
      status: ContentStatus.DRAFT,
      shareableLink: null,
    });

    const savedTutorial = await this.tutorialRepository.save(tutorial);
    savedTutorial.shareableLink = `/tutorials/${savedTutorial.id}`;
    return this.tutorialRepository.save(savedTutorial);
  }

  /**
   * Corrige au passage un gap pré-existant, non lié à l'arbitrage du
   * 2026-09-02 mais nécessaire pour l'implémenter correctement : cette
   * méthode ne prenait auparavant ni callerId ni callerRole et ne
   * vérifiait donc AUCUN statut — un tutoriel DRAFT/pending_validation/
   * rejected était lisible intégralement par n'importe quel compte
   * authentifié, y compris élève.
   */
  async findOne(tutorialId: string, callerId: string, callerRole: string): Promise<Tutorial> {
    const tutorial = await this.tutorialRepository.findOne({
      where: { id: tutorialId },
    });
    if (!tutorial) {
      throw new NotFoundException(`Tutoriel ${tutorialId} introuvable`);
    }

    const isOwner = tutorial.authorId === callerId;
    if (tutorial.status !== ContentStatus.VALIDATED && !isOwner && !this.isAdminRole(callerRole)) {
      // Un tutoriel non validé n'existe pas pour qui n'a pas le droit de le voir
      throw new NotFoundException(`Tutoriel ${tutorialId} introuvable`);
    }

    return tutorial;
  }

  async removeTutorial(tutorialId: string, requesterId: string, callerRole: string): Promise<void> {
    const tutorial = await this.tutorialRepository.findOne({ where: { id: tutorialId } });
    if (!tutorial) {
      throw new NotFoundException(`Tutoriel ${tutorialId} introuvable`);
    }

    const canRemove =
      callerRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      callerRole === UserRole.TECHNICIEN_INFORMATIQUE ||
      tutorial.authorId === requesterId;

    if (!canRemove) {
      throw new ForbiddenException('Vous n\'avez pas le droit de retirer ce tutoriel');
    }

    tutorial.status = ContentStatus.REMOVED;
    await this.tutorialRepository.save(tutorial);
  }
}
