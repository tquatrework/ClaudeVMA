import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentComment } from './entities/content-comment.entity';
import { ContentRating } from './entities/content-rating.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { ContentType } from '../common/enums/content-type.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class ContentsService {
  constructor(
    @InjectRepository(ContentComment)
    private readonly commentRepository: Repository<ContentComment>,

    @InjectRepository(ContentRating)
    private readonly ratingRepository: Repository<ContentRating>,
  ) {}

  async addComment(
    contentId: string,
    contentType: ContentType,
    createCommentDto: CreateCommentDto,
    authorId: string,
    authorRole: string,
  ): Promise<ContentComment> {
    // Les commentaires ne donnent jamais la solution
    // Les indications propriétaire sont taguées spécifiquement
    const isOwnerHintAllowed =
      authorRole === UserRole.FORMATEUR ||
      authorRole === UserRole.ANIMATEUR_PEDAGOGIQUE ||
      authorRole === UserRole.RESPONSABLE_PEDAGOGIQUE;

    const isOwnerHint = createCommentDto.isOwnerHint && isOwnerHintAllowed;

    const comment = this.commentRepository.create({
      contentId,
      contentType,
      authorId,
      authorRole,
      text: createCommentDto.text,
      isOwnerHint: isOwnerHint ?? false,
    });

    return this.commentRepository.save(comment);
  }

  async getComments(contentId: string, contentType: ContentType): Promise<ContentComment[]> {
    return this.commentRepository.find({
      where: { contentId, contentType },
      order: { createdAt: 'ASC' },
    });
  }

  async addRating(
    contentId: string,
    contentType: ContentType,
    createRatingDto: CreateRatingDto,
    authorId: string,
    authorRole: string,
  ): Promise<ContentRating> {
    // Vérifier s'il existe déjà une note de cet auteur sur ce contenu
    const existingRating = await this.ratingRepository.findOne({
      where: { contentId, contentType, authorId },
    });

    if (existingRating) {
      existingRating.score = createRatingDto.score;
      return this.ratingRepository.save(existingRating);
    }

    const rating = this.ratingRepository.create({
      contentId,
      contentType,
      authorId,
      authorRole,
      score: createRatingDto.score,
    });

    return this.ratingRepository.save(rating);
  }

  async getAverageRating(contentId: string, contentType: ContentType): Promise<{ average: number; count: number }> {
    const ratings = await this.ratingRepository.find({
      where: { contentId, contentType },
    });

    if (ratings.length === 0) {
      return { average: 0, count: 0 };
    }

    const totalScore = ratings.reduce((sum, rating) => sum + rating.score, 0);
    return { average: totalScore / ratings.length, count: ratings.length };
  }
}
