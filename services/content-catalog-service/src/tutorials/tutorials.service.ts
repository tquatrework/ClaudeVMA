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

@Injectable()
export class TutorialsService {
  constructor(
    @InjectRepository(Tutorial)
    private readonly tutorialRepository: Repository<Tutorial>,
  ) {}

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

  async findOne(tutorialId: string): Promise<Tutorial> {
    const tutorial = await this.tutorialRepository.findOne({
      where: { id: tutorialId },
    });
    if (!tutorial) {
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
