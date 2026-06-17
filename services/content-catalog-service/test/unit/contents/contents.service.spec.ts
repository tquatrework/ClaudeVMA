/**
 * Unit tests — ContentsService
 *
 * Couvre :
 *   - addComment()        → crée un commentaire, isOwnerHint seulement pour formateurs/AP/RP
 *   - addRating()         → crée ou met à jour le score (1-5) par utilisateur
 *   - getAverageRating()  → calcule la moyenne correctement, gère le cas sans votes
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContentsService } from '../../../src/contents/contents.service';
import { ContentComment } from '../../../src/contents/entities/content-comment.entity';
import { ContentRating } from '../../../src/contents/entities/content-rating.entity';
import { ContentType } from '../../../src/common/enums/content-type.enum';

const AUTHOR_ID    = 'auth-0000-4000-a000-aaaaaaaaaaaa';
const EXERCISE_ID  = 'exer-0000-4000-b000-bbbbbbbbbbbb';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('ContentsService', () => {
  let contentsService: ContentsService;
  let commentRepo: ReturnType<typeof buildMockRepo>;
  let ratingRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    commentRepo = buildMockRepo();
    ratingRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ContentsService,
        { provide: getRepositoryToken(ContentComment), useValue: commentRepo },
        { provide: getRepositoryToken(ContentRating), useValue: ratingRepo },
      ],
    }).compile();

    contentsService = moduleRef.get<ContentsService>(ContentsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // addComment()
  // ─────────────────────────────────────────────────────────────────────────

  describe('addComment()', () => {
    it('crée un commentaire simple pour un élève', async () => {
      const savedComment = {
        id: 'comm-0001',
        contentId: EXERCISE_ID,
        contentType: ContentType.EXERCISE,
        text: 'Bon exercice !',
        isOwnerHint: false,
        authorId: AUTHOR_ID,
        authorRole: 'eleve',
      };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      const result = await contentsService.addComment(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { text: 'Bon exercice !', isOwnerHint: false },
        AUTHOR_ID,
        'eleve',
      );

      expect(result.text).toBe('Bon exercice !');
      expect(result.isOwnerHint).toBe(false);
    });

    it('refuse isOwnerHint=true pour un élève (tag ignoré)', async () => {
      const savedComment = {
        id: 'comm-0002',
        contentId: EXERCISE_ID,
        contentType: ContentType.EXERCISE,
        text: 'Indice',
        isOwnerHint: false,
        authorId: AUTHOR_ID,
        authorRole: 'eleve',
      };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      const result = await contentsService.addComment(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { text: 'Indice', isOwnerHint: true },
        AUTHOR_ID,
        'eleve',
      );

      // L'élève ne peut pas tagger une indication propriétaire
      expect(commentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isOwnerHint: false }),
      );
    });

    it('autorise isOwnerHint=true pour un formateur', async () => {
      const savedComment = {
        id: 'comm-0003',
        contentId: EXERCISE_ID,
        text: 'Indice propriétaire',
        isOwnerHint: true,
        authorId: AUTHOR_ID,
        authorRole: 'formateur',
      };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      const result = await contentsService.addComment(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { text: 'Indice propriétaire', isOwnerHint: true },
        AUTHOR_ID,
        'formateur',
      );

      expect(commentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isOwnerHint: true }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // addRating()
  // ─────────────────────────────────────────────────────────────────────────

  describe('addRating()', () => {
    it('crée une nouvelle note si l\'utilisateur n\'a pas encore voté', async () => {
      ratingRepo.findOne.mockResolvedValue(null);
      const savedRating = { id: 'rat-0001', score: 4, authorId: AUTHOR_ID };
      ratingRepo.create.mockReturnValue(savedRating);
      ratingRepo.save.mockResolvedValue(savedRating);

      const result = await contentsService.addRating(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { score: 4 },
        AUTHOR_ID,
        'eleve',
      );

      expect(result.score).toBe(4);
    });

    it('met à jour la note si l\'utilisateur a déjà voté', async () => {
      const existingRating = { id: 'rat-0002', score: 3, authorId: AUTHOR_ID };
      ratingRepo.findOne.mockResolvedValue(existingRating);
      ratingRepo.save.mockResolvedValue({ ...existingRating, score: 5 });

      const result = await contentsService.addRating(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { score: 5 },
        AUTHOR_ID,
        'eleve',
      );

      expect(ratingRepo.create).not.toHaveBeenCalled();
      expect(ratingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ score: 5 }));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAverageRating()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAverageRating()', () => {
    it('retourne la moyenne correcte pour plusieurs votes', async () => {
      ratingRepo.find.mockResolvedValue([
        { score: 4 },
        { score: 5 },
        { score: 3 },
      ]);

      const result = await contentsService.getAverageRating(EXERCISE_ID, ContentType.EXERCISE);

      expect(result.average).toBeCloseTo(4);
      expect(result.count).toBe(3);
    });

    it('retourne average=0 et count=0 si aucun vote', async () => {
      ratingRepo.find.mockResolvedValue([]);

      const result = await contentsService.getAverageRating(EXERCISE_ID, ContentType.EXERCISE);

      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });
  });
});
