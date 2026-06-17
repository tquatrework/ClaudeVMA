import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Exercise } from './entities/exercise.entity';
import { ExercisePart } from './entities/exercise-part.entity';
import { ExerciseAnswer } from './entities/exercise-answer.entity';
import { ExerciseCorrection } from './entities/exercise-correction.entity';
import { ExerciseSolution } from './entities/exercise-solution.entity';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { SearchExerciseDto } from './dto/search-exercise.dto';
import { CreateExerciseAnswerDto } from './dto/create-exercise-answer.dto';
import { CreateCorrectionRequestDto } from './dto/create-correction-request.dto';
import { ProposeSolutionDto } from './dto/propose-solution.dto';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,

    @InjectRepository(ExercisePart)
    private readonly exercisePartRepository: Repository<ExercisePart>,

    @InjectRepository(ExerciseAnswer)
    private readonly exerciseAnswerRepository: Repository<ExerciseAnswer>,

    @InjectRepository(ExerciseCorrection)
    private readonly exerciseCorrectionRepository: Repository<ExerciseCorrection>,

    @InjectRepository(ExerciseSolution)
    private readonly exerciseSolutionRepository: Repository<ExerciseSolution>,
  ) {}

  async search(searchParams: SearchExerciseDto, callerRole: string): Promise<{ items: Exercise[]; total: number }> {
    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause: FindOptionsWhere<Exercise> = {};

    // Les parents ne voient que les exercices validés
    if (callerRole === UserRole.PARENT_FINANCEUR || callerRole === UserRole.ELEVE) {
      whereClause.status = ContentStatus.VALIDATED;
    }

    if (searchParams.level) whereClause.level = searchParams.level;
    if (searchParams.difficulty) whereClause.difficulty = searchParams.difficulty;
    if (searchParams.theme) whereClause.theme = searchParams.theme;
    if (searchParams.authorId) whereClause.authorId = searchParams.authorId;

    const [items, total] = await this.exerciseRepository.findAndCount({
      where: whereClause,
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async create(
    createExerciseDto: CreateExerciseDto,
    authorId: string,
    authorRole: string,
  ): Promise<Exercise> {
    // Seuls les formateurs et rôles pédagogiques peuvent charger des exercices
    const allowedUploaderRoles = [
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    ];
    if (!allowedUploaderRoles.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs et rôles pédagogiques peuvent charger des exercices');
    }

    const { solutionContent, parts, ...exerciseData } = createExerciseDto;

    const exercise = this.exerciseRepository.create({
      ...exerciseData,
      authorId,
      authorRole,
      status: ContentStatus.DRAFT,
      shareableLink: null,
    });

    const savedExercise = await this.exerciseRepository.save(exercise);

    // Créer les parties si fournies
    if (parts && parts.length > 0) {
      const exerciseParts = parts.map((part) =>
        this.exercisePartRepository.create({
          ...part,
          exerciseId: savedExercise.id,
        }),
      );
      await this.exercisePartRepository.save(exerciseParts);
    }

    // Créer la solution obligatoire
    const solution = this.exerciseSolutionRepository.create({
      exerciseId: savedExercise.id,
      authorId,
      authorRole,
      content: solutionContent,
      cost: 0,
      isValidated: false,
      isOfficial: false,
    });
    await this.exerciseSolutionRepository.save(solution);

    // Générer le lien partageable
    savedExercise.shareableLink = `/exercises/${savedExercise.id}`;
    return this.exerciseRepository.save(savedExercise);
  }

  async findOne(exerciseId: string): Promise<Exercise> {
    const exercise = await this.exerciseRepository.findOne({
      where: { id: exerciseId },
      relations: ['parts'],
    });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }
    return exercise;
  }

  async submitAnswer(
    exerciseId: string,
    createAnswerDto: CreateExerciseAnswerDto,
    studentId: string,
    callerRole: string,
  ): Promise<ExerciseAnswer> {
    if (callerRole !== UserRole.ELEVE) {
      throw new ForbiddenException('Seuls les élèves peuvent soumettre des réponses');
    }

    const exercise = await this.exerciseRepository.findOne({ where: { id: exerciseId } });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }
    if (exercise.status !== ContentStatus.VALIDATED) {
      throw new BadRequestException('Cet exercice n\'est pas disponible');
    }

    const answer = this.exerciseAnswerRepository.create({
      exerciseId,
      studentId,
      content: createAnswerDto.content,
      partId: createAnswerDto.partId,
      correctionRequested: false,
    });

    return this.exerciseAnswerRepository.save(answer);
  }

  async requestCorrection(
    answerId: string,
    requestDto: CreateCorrectionRequestDto,
    requesterId: string,
    callerRole: string,
  ): Promise<ExerciseAnswer> {
    const answer = await this.exerciseAnswerRepository.findOne({ where: { id: answerId } });
    if (!answer) {
      throw new NotFoundException(`Réponse ${answerId} introuvable`);
    }

    if (callerRole === UserRole.ELEVE && answer.studentId !== requesterId) {
      throw new ForbiddenException('Vous ne pouvez demander une correction que pour vos propres réponses');
    }

    if (answer.correctionRequested) {
      throw new BadRequestException('Une correction a déjà été demandée pour cette réponse');
    }

    answer.correctionRequested = true;
    return this.exerciseAnswerRepository.save(answer);
  }

  async proposeSolution(
    exerciseId: string,
    proposeSolutionDto: ProposeSolutionDto,
    authorId: string,
    authorRole: string,
  ): Promise<ExerciseSolution> {
    const allowedRoles = [
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    ];
    if (!allowedRoles.includes(authorRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs et rôles pédagogiques peuvent proposer des solutions');
    }

    const exercise = await this.exerciseRepository.findOne({ where: { id: exerciseId } });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }

    const solution = this.exerciseSolutionRepository.create({
      exerciseId,
      authorId,
      authorRole,
      content: proposeSolutionDto.content,
      cost: proposeSolutionDto.cost ?? 0,
      isValidated: false,
      isOfficial: false,
    });

    return this.exerciseSolutionRepository.save(solution);
  }

  async getOfficialSolution(exerciseId: string, requesterId: string, callerRole: string): Promise<ExerciseSolution> {
    const exercise = await this.exerciseRepository.findOne({ where: { id: exerciseId } });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }

    // La solution officielle est la moins chère des solutions validées
    const solutions = await this.exerciseSolutionRepository.find({
      where: { exerciseId, isValidated: true },
      order: { cost: 'ASC' },
    });

    if (solutions.length === 0) {
      throw new NotFoundException('Aucune solution validée disponible pour cet exercice');
    }

    return solutions[0];
  }

  async removeExercise(exerciseId: string, requesterId: string, callerRole: string): Promise<void> {
    const exercise = await this.exerciseRepository.findOne({ where: { id: exerciseId } });
    if (!exercise) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }

    const canRemove =
      callerRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      callerRole === UserRole.TECHNICIEN_INFORMATIQUE ||
      exercise.authorId === requesterId;

    if (!canRemove) {
      throw new ForbiddenException('Vous n\'avez pas le droit de retirer cet exercice');
    }

    exercise.status = ContentStatus.REMOVED;
    await this.exerciseRepository.save(exercise);
  }
}
