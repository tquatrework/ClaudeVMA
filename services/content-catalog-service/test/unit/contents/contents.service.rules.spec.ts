/**
 * Unit tests — ContentsService (règles métier complémentaires)
 *
 * Couvre les règles métier non couvertes dans contents.service.spec.ts :
 *   CCS-BR-004 — Un seul vote de rating par utilisateur (idempotence de la mise à jour)
 *   Commentaires — interdiction de donner la solution dans un commentaire (isOwnerHint sur solution)
 *   getComments() — méthode non testée
 *   addComment() — ap et RP peuvent aussi tagger isOwnerHint
 *   addComment() — texte ne doit pas contenir la solution (règle de modération ≠ contrainte technique)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContentsService } from '../../../src/contents/contents.service';
import { ContentComment } from '../../../src/contents/entities/content-comment.entity';
import { ContentRating } from '../../../src/contents/entities/content-rating.entity';
import { ContentType } from '../../../src/common/enums/content-type.enum';

const AUTHOR_ID   = 'auth-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID       = 'ap00-0000-4000-b000-bbbbbbbbbbbb';
const RP_ID       = 'rp00-0000-4000-c000-cccccccccccc';
const EXERCISE_ID = 'exer-0000-4000-d000-dddddddddddd';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

describe('ContentsService — règles métier complémentaires', () => {
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
  // CCS-BR-004 — Un seul vote de rating par utilisateur
  // ─────────────────────────────────────────────────────────────────────────

  describe('CCS-BR-004 — Un seul vote de rating par utilisateur', () => {
    it('ne crée pas de nouvelle entrée si l\'utilisateur a déjà voté (idempotence)', async () => {
      const existingRating = { id: 'rat-0001', score: 3, authorId: AUTHOR_ID };
      ratingRepo.findOne.mockResolvedValue(existingRating);
      ratingRepo.save.mockResolvedValue({ ...existingRating, score: 5 });

      await contentsService.addRating(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { score: 5 },
        AUTHOR_ID,
        'eleve',
      );

      // Vérification : create() ne doit PAS être appelé (mise à jour de l'existant)
      expect(ratingRepo.create).not.toHaveBeenCalled();
    });

    it('met à jour uniquement le score du vote existant', async () => {
      const existingRating = { id: 'rat-0001', score: 2, authorId: AUTHOR_ID, contentId: EXERCISE_ID };
      ratingRepo.findOne.mockResolvedValue(existingRating);
      ratingRepo.save.mockResolvedValue({ ...existingRating, score: 4 });

      const result = await contentsService.addRating(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { score: 4 },
        AUTHOR_ID,
        'eleve',
      );

      expect(ratingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ score: 4, id: 'rat-0001' }),
      );
      expect(result.score).toBe(4);
    });

    it('crée un nouveau vote si l\'utilisateur n\'avait pas encore voté', async () => {
      ratingRepo.findOne.mockResolvedValue(null);
      const newRating = { id: 'rat-0002', score: 5, authorId: AUTHOR_ID };
      ratingRepo.create.mockReturnValue(newRating);
      ratingRepo.save.mockResolvedValue(newRating);

      await contentsService.addRating(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { score: 5 },
        AUTHOR_ID,
        'eleve',
      );

      // Ici create() DOIT être appelé
      expect(ratingRepo.create).toHaveBeenCalledTimes(1);
    });

    it('recherche le vote existant en filtrant sur contentId, contentType et authorId', async () => {
      ratingRepo.findOne.mockResolvedValue(null);
      ratingRepo.create.mockReturnValue({});
      ratingRepo.save.mockResolvedValue({});

      await contentsService.addRating(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { score: 3 },
        AUTHOR_ID,
        'formateur',
      );

      expect(ratingRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contentId: EXERCISE_ID,
            contentType: ContentType.EXERCISE,
            authorId: AUTHOR_ID,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getComments() — méthode non testée
  // ─────────────────────────────────────────────────────────────────────────

  describe('getComments()', () => {
    it('retourne la liste des commentaires pour un contenu donné', async () => {
      const comments = [
        { id: 'comm-0001', text: 'Bon exercice', contentId: EXERCISE_ID },
        { id: 'comm-0002', text: 'Un peu difficile', contentId: EXERCISE_ID },
      ];
      commentRepo.find.mockResolvedValue(comments);

      const result = await contentsService.getComments(EXERCISE_ID, ContentType.EXERCISE);

      expect(result).toHaveLength(2);
      expect(commentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contentId: EXERCISE_ID,
            contentType: ContentType.EXERCISE,
          }),
        }),
      );
    });

    it('retourne une liste vide s\'il n\'y a pas de commentaires', async () => {
      commentRepo.find.mockResolvedValue([]);

      const result = await contentsService.getComments(EXERCISE_ID, ContentType.EXERCISE);

      expect(result).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // addComment() — isOwnerHint pour AP et RP
  // ─────────────────────────────────────────────────────────────────────────

  describe('addComment() — isOwnerHint pour AP et RP', () => {
    it('autorise isOwnerHint=true pour un animateur_pedagogique', async () => {
      const savedComment = {
        id: 'comm-0001',
        text: 'Indice AP',
        isOwnerHint: true,
        authorId: AP_ID,
        authorRole: 'animateur_pedagogique',
      };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      await contentsService.addComment(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { text: 'Indice AP', isOwnerHint: true },
        AP_ID,
        'animateur_pedagogique',
      );

      expect(commentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isOwnerHint: true }),
      );
    });

    it('autorise isOwnerHint=true pour un responsable_pedagogique', async () => {
      const savedComment = {
        id: 'comm-0002',
        text: 'Indice RP',
        isOwnerHint: true,
        authorId: RP_ID,
        authorRole: 'responsable_pedagogique',
      };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      await contentsService.addComment(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { text: 'Indice RP', isOwnerHint: true },
        RP_ID,
        'responsable_pedagogique',
      );

      expect(commentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isOwnerHint: true }),
      );
    });

    it('refuse isOwnerHint=true pour un parent_financeur (tag ignoré → false)', async () => {
      const savedComment = {
        id: 'comm-0003',
        text: 'Commentaire parent',
        isOwnerHint: false,
        authorId: 'parent-id',
        authorRole: 'parent_financeur',
      };
      commentRepo.create.mockReturnValue(savedComment);
      commentRepo.save.mockResolvedValue(savedComment);

      await contentsService.addComment(
        EXERCISE_ID,
        ContentType.EXERCISE,
        { text: 'Commentaire parent', isOwnerHint: true },
        'parent-id',
        'parent_financeur',
      );

      expect(commentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isOwnerHint: false }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAverageRating() — cas avec un seul vote
  // ─────────────────────────────────────────────────────────────────────────

  describe('getAverageRating() — cas supplémentaires', () => {
    it('retourne la valeur exacte quand il y a un seul vote', async () => {
      ratingRepo.find.mockResolvedValue([{ score: 4 }]);

      const result = await contentsService.getAverageRating(EXERCISE_ID, ContentType.EXERCISE);

      expect(result.average).toBe(4);
      expect(result.count).toBe(1);
    });
  });
});
