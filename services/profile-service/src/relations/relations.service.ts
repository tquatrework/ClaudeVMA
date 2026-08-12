import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { FinanceOwnerStudentLink } from './entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from './entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from './entities/pedagogical-coordinator-link.entity';
import { AnimatorTeacherLink } from './entities/animator-teacher-link.entity';
import { CreateFinanceOwnerStudentLinkDto } from './dto/create-finance-owner-student-link.dto';
import { CreateTeacherStudentLinkDto } from './dto/create-teacher-student-link.dto';
import { CreatePedagogicalCoordinatorLinkDto } from './dto/create-pedagogical-coordinator-link.dto';
import { CreateAnimatorTeacherLinkDto } from './dto/create-animator-teacher-link.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../common/types/actor.type';
import {
  AdministrativeName,
  AdministrativeProfileLookupService,
} from '../profiles/administrative-profile-lookup.service';
import { RelationKind, ResolvedRelation } from './relation-kind';

/**
 * Une personne à laquelle l'utilisateur courant est relié, telle qu'un écran a
 * besoin de la lire : un NOM, et la nature du lien. `userId` n'est là que pour
 * construire l'appel suivant (`/statistics`, `/pedagogical-archives`) — il ne
 * doit jamais être affiché (arbitrage du 2026-08-09 : aucun UUID à l'écran, sauf
 * pour l'administrateur financier).
 */
export interface RelatedPerson {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  relations: ResolvedRelation[];
}

@Injectable()
export class RelationsService {
  constructor(
    @InjectRepository(FinanceOwnerStudentLink)
    private readonly financeRepo: Repository<FinanceOwnerStudentLink>,
    @InjectRepository(TeacherStudentLink)
    private readonly teacherRepo: Repository<TeacherStudentLink>,
    @InjectRepository(PedagogicalCoordinatorLink)
    private readonly coordinatorRepo: Repository<PedagogicalCoordinatorLink>,
    @InjectRepository(AnimatorTeacherLink)
    private readonly animatorRepo: Repository<AnimatorTeacherLink>,
    private readonly events: EventsService,
    private readonly administrativeProfileLookup: AdministrativeProfileLookupService,
  ) {}

  /**
   * Create a financeur→élève link.
   * Allowed for RP and AdministrateurFinancier.
   */
  async linkFinanceOwnerToStudent(dto: CreateFinanceOwnerStudentLinkDto, actor: Actor) {
    const allowed = [UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER];
    if (!allowed.includes(actor.role)) {
      throw new ForbiddenException('Only RP or AdministrateurFinancier can create financeur–étudiant links');
    }

    /**
     * Le conflit porte sur l'état COURANT (`endedAt IS NULL`), jamais sur
     * l'existence d'une ligne : un lien rompu ne doit pas interdire à vie de
     * rattacher de nouveau les mêmes personnes. C'est exactement le défaut du
     * `409 "Consent already signed"` corrigé le 2026-08-09.
     */
    const existing = await this.findActiveFinanceLink(dto.financeOwnerId, dto.studentId);
    if (existing) {
      throw new ConflictException('This financeur is already linked to this student');
    }

    const link = this.financeRepo.create(dto);
    const saved = await this.financeRepo.save(link);

    this.events.publish('StudentLinkedToFinanceOwner', {
      financeOwnerId: dto.financeOwnerId,
      studentId: dto.studentId,
      actorId: actor.id,
    });

    return saved;
  }

  /**
   * List all students linked to a financeur.
   * Accessible to RP, AdministrateurFinancier, and the financeur themselves.
   * Each item is enriched with the student's name (studentName), resolved
   * from AdministrativeProfileLookupService — see attachStudentNames.
   */
  async getStudentsByFinanceOwner(financeOwnerId: string, actor: Actor) {
    const allowed = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (!allowed.includes(actor.role) && actor.id !== financeOwnerId) {
      throw new ForbiddenException('You may only list your own linked students');
    }

    const links = await this.financeRepo.find({
      where: { financeOwnerId, endedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return this.attachStudentNames(links);
  }

  /**
   * Create a formateur→élève link.
   * Restricted to RP only.
   */
  async linkTeacherToStudent(dto: CreateTeacherStudentLinkDto, actor: Actor) {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only RP can create formateur–étudiant links');
    }

    /**
     * Le conflit porte sur l'état COURANT (`endedAt IS NULL`), jamais sur
     * l'existence d'une ligne : une relation terminée ne doit pas interdire à
     * vie de relier les mêmes personnes (arbitrage du 2026-08-12, point 6 —
     * « un arrêt n'est pas un bannissement »). Même correction que celle
     * apportée au lien financeur le 2026-08-11.
     */
    const existing = await this.findActiveTeacherLink(dto.teacherId, dto.studentId);
    if (existing) {
      throw new ConflictException('This teacher is already linked to this student');
    }

    const link = this.teacherRepo.create({
      teacherId: dto.teacherId,
      studentId: dto.studentId,
      isPrincipalTeacher: dto.isPrincipalTeacher ?? false,
    });
    const saved = await this.teacherRepo.save(link);

    this.events.publish('TeacherLinkedToStudent', {
      teacherId: dto.teacherId,
      studentId: dto.studentId,
      isPrincipalTeacher: saved.isPrincipalTeacher,
      actorId: actor.id,
    });

    return saved;
  }

  /**
   * Liste les formateurs ACTIFS d'un élève.
   * Accessible au RP, au TI, à l'AF, à l'élève lui-même, et à tout
   * PARENT_FINANCEUR effectivement lié à cet élève. Un formateur n'y voit que
   * son propre lien (PROF-FB-003).
   *
   * C'est la liste que le RP consulte sur la fiche de l'élève AVANT de proposer
   * d'en terminer une (arbitrage du 2026-08-12, point 3 : le point d'action est
   * la fiche de l'élève). Chaque entrée porte donc `teacherName` : sans lui
   * l'écran n'aurait qu'un UUID à afficher, ce que l'arbitrage du 2026-08-09
   * interdit. Même traitement que `getFinanceOwnersByStudent` et
   * `getTeachersByAnimator`.
   *
   * Ne renvoie QUE les relations actives : une relation terminée n'a plus à
   * apparaître comme un lien courant, et surtout ne doit plus offrir de bouton
   * « supprimer ». L'historique reste en base, il n'est simplement pas ce que
   * cette route décrit.
   */
  async getTeachersByStudent(studentId: string, actor: Actor) {
    const privileged = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];

    if (privileged.includes(actor.role) || actor.id === studentId) {
      return this.attachTeacherNames(
        await this.teacherRepo.find({
          where: { studentId, endedAt: IsNull() },
          order: { createdAt: 'ASC' },
        }),
      );
    }

    // A formateur may see only their own link to the student (PROF-FB-003)
    if (actor.role === UserRole.FORMATEUR) {
      return this.attachTeacherNames(
        await this.teacherRepo.find({
          where: { teacherId: actor.id, studentId, endedAt: IsNull() },
        }),
      );
    }

    // A PARENT_FINANCEUR may see all teachers of a student they are linked to
    if (actor.role === UserRole.PARENT_FINANCEUR) {
      const parentStudentLink = await this.findActiveFinanceLink(actor.id, studentId);
      if (!parentStudentLink) {
        throw new ForbiddenException(
          'You are not linked to this student and cannot list their teachers',
        );
      }
      return this.attachTeacherNames(
        await this.teacherRepo.find({
          where: { studentId, endedAt: IsNull() },
          order: { createdAt: 'ASC' },
        }),
      );
    }

    throw new ForbiddenException('Insufficient rights to list teachers for this student');
  }

  /**
   * List all financeurs (parents) linked to a given student.
   * Symmetric counterpart of getStudentsByFinanceOwner.
   * Accessible to the student themselves, RP, TI, and AdministrateurFinancier.
   * Each item is enriched with the financeur's name (financeOwnerName),
   * resolved from AdministrativeProfileLookupService — see
   * attachFinanceOwnerNames. Fixes a bug where the finance-owners tab on a
   * student's profile only ever showed the financeur's raw UUID.
   */
  async getFinanceOwnersByStudent(studentId: string, actor: Actor) {
    const privilegedRoles = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];

    if (!privilegedRoles.includes(actor.role) && actor.id !== studentId) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que vos propres financeurs rattachés',
      );
    }

    const links = await this.financeRepo.find({
      where: { studentId, endedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return this.attachFinanceOwnerNames(links);
  }

  /**
   * Rompt le lien parent financeur ↔ élève (besoin du 2026-08-11, « Délier »).
   *
   * QUI A LE DROIT : les deux parties du lien, plus le RP et le TI. Le contrôle
   * porte sur la PROPRIÉTÉ DU LIEN — « suis-je l'une des deux personnes
   * nommées ? » — et non sur une liste de rôles, qui en oublierait un à chaque
   * évolution (même forme que `@OwnerAccess()`). L'AF est volontairement exclu :
   * il constate les rattachements, il ne décide pas de les rompre. Il peut en
   * créer un (`POST /relations/finance-owner-student`) parce que c'est un acte
   * d'administration à la demande ; le défaire engage la relation entre deux
   * personnes, il revient à ces personnes ou au RP.
   *
   * REFUS = 404, AVEC LE MÊME MESSAGE QU'UNE ABSENCE. Un 403 dirait « ce lien
   * existe, mais il ne vous regarde pas » : il révélerait précisément ce qu'on
   * refuse de montrer (arbitrage du 2026-08-11, point 5). Un tiers ne peut donc
   * pas se servir de cette route pour découvrir qui finance qui.
   *
   * IDEMPOTENCE : délier un lien DÉJÀ rompu renvoie 200 et la ligne telle
   * quelle, sans toucher `endedAt`/`endedBy`. Motif : l'état visé — « ces deux
   * personnes ne sont plus liées » — est atteint ; répondre en erreur ferait
   * échouer un second clic, ou un rejeu réseau, sur une situation pourtant
   * conforme. La date de rupture initiale est préservée : c'est elle qui a une
   * valeur de preuve, l'écraser reviendrait à falsifier l'historique. La
   * décision reste lisible côté appelant, qui lit `endedAt` dans la réponse.
   *
   * Ce que la rupture referme : toutes les requêtes de ce service ne lisent que
   * les liens ACTIFS. Le parent perd donc, dans le même mouvement, la lecture du
   * profil de l'ex-élève, ses statistiques pédagogiques et — via
   * `GET /internal/relations/:viewerId/:targetId` — ses archives pédagogiques.
   * Aucun autre service n'a à être prévenu pour cela.
   */
  async unlinkFinanceOwnerFromStudent(
    financeOwnerId: string,
    studentId: string,
    actor: Actor,
  ): Promise<FinanceOwnerStudentLink> {
    /**
     * On cherche le lien le plus récent de la paire, ACTIF OU ROMPU. Chercher
     * uniquement l'actif rendrait le second appel indiscernable d'un lien
     * inexistant, et surtout retirerait aux deux parties le droit de constater
     * leur propre rupture : après le premier appel, elles ne sont plus « liées ».
     */
    const link = await this.financeRepo.findOne({
      where: { financeOwnerId, studentId },
      order: { createdAt: 'DESC' },
    });

    if (!link || !this.mayUnlink(link, actor)) {
      throw new NotFoundException(noFinanceOwnerStudentLinkMessage());
    }

    if (link.endedAt) return link;

    link.endedAt = new Date();
    link.endedBy = actor.id;
    const saved = await this.financeRepo.save(link);

    this.events.publish('StudentUnlinkedFromFinanceOwner', {
      financeOwnerId,
      studentId,
      actorId: actor.id,
      endedAt: saved.endedAt?.toISOString(),
    });

    return saved;
  }

  /**
   * Met fin à la relation élève ↔ formateur (arbitrage du 2026-08-12).
   *
   * QUI A LE DROIT : le RP, et lui SEUL. Ni le formateur, ni l'élève, ni le
   * parent financeur, ni même le TI. C'est une DIFFÉRENCE ASSUMÉE avec la
   * rupture du lien parent financeur (2026-08-11), où chacune des deux parties
   * peut rompre : un lien parent-élève est un arrangement familial privé, tandis
   * qu'une relation élève↔formateur est une AFFECTATION PÉDAGOGIQUE PRONONCÉE
   * PAR LE RP — la défaire lui revient donc aussi. `mayUnlink()` (propriété du
   * lien) ne s'applique pas ici, et `@OwnerAccess()` non plus.
   *
   * POURQUOI 404 ET NON 403 SUR UN LIEN ABSENT : le contrôle de rôle est déjà
   * fait en amont (403 pour un non-RP). L'appelant est donc nécessairement un
   * RP, qui a de toute façon accès à tout (2026-08-11, point 3) : lui dire que
   * la relation n'existe pas ne lui révèle rien qu'il ne puisse lire ailleurs.
   * Le masquage par 404 de la route financeur répondait à un autre risque —
   * l'appelant pouvait y être un tiers quelconque.
   *
   * IDEMPOTENCE : terminer une relation DÉJÀ terminée renvoie 200 et la ligne
   * telle quelle, sans toucher `endedAt`/`endedBy`/`endReason`. Motif : l'état
   * visé — « ces deux personnes ne sont plus liées » — est atteint ; répondre en
   * erreur ferait échouer un second clic, ou un rejeu réseau, sur une situation
   * pourtant conforme. La date de fin initiale est préservée : c'est elle qui a
   * une valeur de preuve, l'écraser reviendrait à falsifier l'historique — et le
   * motif initial serait perdu au profit d'un second, saisi après coup. La
   * décision reste lisible côté appelant, qui lit `endedAt` dans la réponse.
   *
   * AUCUNE FIN AUTOMATIQUE (point 2) : cette méthode n'est appelée que par
   * l'action explicite d'un RP. Valider un nouveau professeur ne met pas fin au
   * précédent — aucun autre chemin du service ne l'invoque.
   *
   * CE QUE LA FIN REFERME : toutes les requêtes de ce service ne lisent que les
   * relations ACTIVES. Le formateur perd donc, dans le même mouvement, la
   * lecture du profil de l'ex-élève, ses statistiques pédagogiques et — via
   * `GET /internal/relations/:viewerId/:targetId` — ses archives pédagogiques.
   * Aucun autre service n'a à être prévenu pour cela.
   */
  async endTeacherStudentLink(
    teacherId: string,
    studentId: string,
    actor: Actor,
    reason?: string,
  ): Promise<TeacherStudentLink> {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException(
        'Seul un responsable pédagogique peut mettre fin à une relation élève-professeur.',
      );
    }

    /**
     * On cherche la relation la plus récente de la paire, ACTIVE OU TERMINÉE.
     * Chercher uniquement l'active rendrait le second appel indiscernable d'une
     * relation inexistante, et ferait donc échouer un rejeu pourtant conforme.
     */
    const link = await this.teacherRepo.findOne({
      where: { teacherId, studentId },
      order: { createdAt: 'DESC' },
    });

    if (!link) {
      throw new NotFoundException(noTeacherStudentLinkMessage());
    }

    if (link.endedAt) return link;

    link.endedAt = new Date();
    link.endedBy = actor.id;
    link.endReason = reason ?? null;
    const saved = await this.teacherRepo.save(link);

    this.events.publish('TeacherUnlinkedFromStudent', {
      teacherId,
      studentId,
      actorId: actor.id,
      endedAt: saved.endedAt?.toISOString(),
      reason: saved.endReason,
    });

    return saved;
  }

  /**
   * Propriété du lien : l'une des deux personnes nommées, ou un rôle habilité à
   * arbitrer la relation (RP, TI). Volontairement écrit à part de la route :
   * c'est la règle, pas un détail de transport.
   *
   * NE S'APPLIQUE QU'AU LIEN PARENT FINANCEUR ↔ ÉLÈVE. La fin d'une relation
   * élève↔formateur suit une règle différente et volontairement plus étroite —
   * le RP seul, voir `endTeacherStudentLink`.
   */
  private mayUnlink(link: FinanceOwnerStudentLink, actor: Actor): boolean {
    if (actor.id === link.financeOwnerId || actor.id === link.studentId) return true;
    return (
      actor.role === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      actor.role === UserRole.TECHNICIEN_INFORMATIQUE
    );
  }

  /**
   * Assign a RP or AP as coordinator for a student (PROF-BR-004 / responsibility 4).
   * Restricted to RP only.
   */
  async linkPedagogicalCoordinator(dto: CreatePedagogicalCoordinatorLinkDto, actor: Actor) {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only RP can assign a pedagogical coordinator');
    }

    const existing = await this.coordinatorRepo.findOne({
      where: { coordinatorId: dto.coordinatorId, studentId: dto.studentId },
    });
    if (existing) {
      throw new ConflictException('This coordinator is already linked to this student');
    }

    const link = this.coordinatorRepo.create(dto);
    const saved = await this.coordinatorRepo.save(link);

    this.events.publish('CoordinatorLinkedToStudent', {
      coordinatorId: dto.coordinatorId,
      studentId: dto.studentId,
      coordinatorRole: dto.coordinatorRole,
      actorId: actor.id,
    });

    return saved;
  }

  /**
   * List all students assigned to a coordinator.
   * Accessible to RP, TI, and the coordinator themselves.
   */
  async getStudentsByCoordinator(coordinatorId: string, actor: Actor) {
    const privileged = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (!privileged.includes(actor.role) && actor.id !== coordinatorId) {
      throw new ForbiddenException('You may only list your own students');
    }
    return this.coordinatorRepo.find({ where: { coordinatorId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Rattache un AP à un formateur qu'il anime (arbitrage du 2026-08-11).
   * Réservé au RP : c'est lui qui promeut un formateur en AP
   * (`POST /profiles/:teacherId/ap-status`), c'est donc lui qui décide de ce
   * qu'un AP anime. Un AP ne se donne pas ses propres animés.
   */
  async linkAnimatorToTeacher(dto: CreateAnimatorTeacherLinkDto, actor: Actor) {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only RP can link an animateur pédagogique to a formateur');
    }

    const existing = await this.animatorRepo.findOne({
      where: { animatorId: dto.animatorId, teacherId: dto.teacherId },
    });
    if (existing) {
      throw new ConflictException('This animateur is already linked to this formateur');
    }

    const saved = await this.animatorRepo.save(this.animatorRepo.create(dto));

    this.events.publish('AnimatorLinkedToTeacher', {
      animatorId: dto.animatorId,
      teacherId: dto.teacherId,
      actorId: actor.id,
    });

    return saved;
  }

  /**
   * Liste les formateurs animés par un AP.
   * Accessible au RP, au TI et à l'AP lui-même.
   */
  async getTeachersByAnimator(animatorId: string, actor: Actor) {
    const privileged = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (!privileged.includes(actor.role) && actor.id !== animatorId) {
      throw new ForbiddenException('You may only list the formateurs you animate');
    }

    const links = await this.animatorRepo.find({
      where: { animatorId },
      order: { createdAt: 'ASC' },
    });
    return this.attachTeacherNames(links);
  }

  // ---------------------------------------------------------------------------
  // Résolution des relations — socle du droit d'accès au pédagogique
  // ---------------------------------------------------------------------------

  /**
   * Toutes les relations métier entre deux personnes, ORIENTÉES du lecteur vers
   * la cible. Liste vide = aucun lien.
   *
   * C'est le point unique consommé par :
   *  - `GET /profiles/:userId/statistics` (ce service) ;
   *  - `GET /internal/relations/:viewerId/:targetId` (archive-document-service).
   * Un second calcul écrit ailleurs divergerait au premier arbitrage suivant.
   *
   * Coût : quatre requêtes à plat, quel que soit le nombre de liens. Les
   * relations INDIRECTES (parent ↔ formateur, via l'élève commun) sont calculées
   * en mémoire par intersection des élèves des deux parties — inutile d'aller
   * chercher en base une jointure que ces deux ensembles suffisent à décider.
   */
  async resolveRelations(viewerId: string, targetId: string): Promise<ResolvedRelation[]> {
    if (viewerId === targetId) return [];

    const pair = [viewerId, targetId];
    const [financeLinks, teacherLinks, animatorLinks, coordinatorLinks] = await Promise.all([
      // Liens ACTIFS seulement : un lien rompu ne doit plus rien ouvrir, ni ici
      // ni chez les services qui consomment `/internal/relations/...`.
      this.financeRepo.find({
        where: [
          { financeOwnerId: In(pair), endedAt: IsNull() },
          { studentId: In(pair), endedAt: IsNull() },
        ],
      }),
      this.teacherRepo.find({
        where: [
          { teacherId: In(pair), endedAt: IsNull() },
          { studentId: In(pair), endedAt: IsNull() },
        ],
      }),
      this.animatorRepo.find({
        where: [{ animatorId: In(pair) }, { teacherId: In(pair) }],
      }),
      this.coordinatorRepo.find({
        where: [{ coordinatorId: In(pair) }, { studentId: In(pair) }],
      }),
    ]);

    const relations: ResolvedRelation[] = [];

    // --- liens directs --------------------------------------------------------
    for (const link of financeLinks) {
      if (link.financeOwnerId === viewerId && link.studentId === targetId) {
        relations.push({ kind: RelationKind.FINANCE_OWNER_OF_STUDENT });
      }
      if (link.financeOwnerId === targetId && link.studentId === viewerId) {
        relations.push({ kind: RelationKind.STUDENT_OF_FINANCE_OWNER });
      }
    }

    for (const link of teacherLinks) {
      if (link.teacherId === viewerId && link.studentId === targetId) {
        relations.push({
          kind: RelationKind.TEACHER_OF_STUDENT,
          isPrincipalTeacher: link.isPrincipalTeacher,
        });
      }
      if (link.teacherId === targetId && link.studentId === viewerId) {
        relations.push({
          kind: RelationKind.STUDENT_OF_TEACHER,
          isPrincipalTeacher: link.isPrincipalTeacher,
        });
      }
    }

    for (const link of animatorLinks) {
      if (link.animatorId === viewerId && link.teacherId === targetId) {
        relations.push({ kind: RelationKind.ANIMATOR_OF_TEACHER });
      }
      if (link.animatorId === targetId && link.teacherId === viewerId) {
        relations.push({ kind: RelationKind.TEACHER_OF_ANIMATOR });
      }
    }

    for (const link of coordinatorLinks) {
      if (link.coordinatorId === viewerId && link.studentId === targetId) {
        relations.push({ kind: RelationKind.COORDINATOR_OF_STUDENT });
      }
      if (link.coordinatorId === targetId && link.studentId === viewerId) {
        relations.push({ kind: RelationKind.STUDENT_OF_COORDINATOR });
      }
    }

    // --- liens indirects parent ↔ formateur, par l'élève commun ---------------
    const studentsFinancedByViewer = financeLinks
      .filter((link) => link.financeOwnerId === viewerId)
      .map((link) => link.studentId);
    const studentsFinancedByTarget = financeLinks
      .filter((link) => link.financeOwnerId === targetId)
      .map((link) => link.studentId);
    const studentsTaughtByViewer = teacherLinks
      .filter((link) => link.teacherId === viewerId)
      .map((link) => link.studentId);
    const studentsTaughtByTarget = teacherLinks
      .filter((link) => link.teacherId === targetId)
      .map((link) => link.studentId);

    const viewerFinancesTargetsStudents = intersect(
      studentsFinancedByViewer,
      studentsTaughtByTarget,
    );
    if (viewerFinancesTargetsStudents.length > 0) {
      relations.push({
        kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER,
        throughUserIds: viewerFinancesTargetsStudents,
      });
    }

    const viewerTeachesTargetsStudents = intersect(
      studentsTaughtByViewer,
      studentsFinancedByTarget,
    );
    if (viewerTeachesTargetsStudents.length > 0) {
      relations.push({
        kind: RelationKind.TEACHER_OF_STUDENT_OF_FINANCE_OWNER,
        throughUserIds: viewerTeachesTargetsStudents,
      });
    }

    return relations;
  }

  /**
   * Toutes les personnes auxquelles un utilisateur est relié, avec leur NOM et
   * la nature du lien — de quoi construire un sélecteur « qui consulter ? » sans
   * afficher un seul UUID et sans N+1 (un seul batch de résolution de noms).
   *
   * Les relations indirectes (parent ↔ formateur de son élève) sont incluses :
   * c'est précisément ce qui permet à un parent de choisir le formateur de son
   * enfant dans une liste, sans qu'aucune table ne porte ce lien.
   */
  async listRelatedPeople(userId: string): Promise<RelatedPerson[]> {
    const [financeLinks, teacherLinks, animatorLinks, coordinatorLinks] = await Promise.all([
      this.financeRepo.find({
        where: [
          { financeOwnerId: userId, endedAt: IsNull() },
          { studentId: userId, endedAt: IsNull() },
        ],
      }),
      this.teacherRepo.find({
        where: [
          { teacherId: userId, endedAt: IsNull() },
          { studentId: userId, endedAt: IsNull() },
        ],
      }),
      this.animatorRepo.find({ where: [{ animatorId: userId }, { teacherId: userId }] }),
      this.coordinatorRepo.find({ where: [{ coordinatorId: userId }, { studentId: userId }] }),
    ]);

    const relationsByUserId = new Map<string, ResolvedRelation[]>();
    const add = (otherUserId: string, relation: ResolvedRelation) => {
      if (otherUserId === userId) return;
      const existing = relationsByUserId.get(otherUserId) ?? [];
      existing.push(relation);
      relationsByUserId.set(otherUserId, existing);
    };

    for (const link of financeLinks) {
      if (link.financeOwnerId === userId) {
        add(link.studentId, { kind: RelationKind.FINANCE_OWNER_OF_STUDENT });
      }
      if (link.studentId === userId) {
        add(link.financeOwnerId, { kind: RelationKind.STUDENT_OF_FINANCE_OWNER });
      }
    }

    for (const link of teacherLinks) {
      if (link.teacherId === userId) {
        add(link.studentId, {
          kind: RelationKind.TEACHER_OF_STUDENT,
          isPrincipalTeacher: link.isPrincipalTeacher,
        });
      }
      if (link.studentId === userId) {
        add(link.teacherId, {
          kind: RelationKind.STUDENT_OF_TEACHER,
          isPrincipalTeacher: link.isPrincipalTeacher,
        });
      }
    }

    for (const link of animatorLinks) {
      if (link.animatorId === userId) add(link.teacherId, { kind: RelationKind.ANIMATOR_OF_TEACHER });
      if (link.teacherId === userId) add(link.animatorId, { kind: RelationKind.TEACHER_OF_ANIMATOR });
    }

    for (const link of coordinatorLinks) {
      if (link.coordinatorId === userId) {
        add(link.studentId, { kind: RelationKind.COORDINATOR_OF_STUDENT });
      }
      if (link.studentId === userId) {
        add(link.coordinatorId, { kind: RelationKind.STUDENT_OF_COORDINATOR });
      }
    }

    // --- relations indirectes, par les élèves du lecteur ----------------------
    const financedStudentIds = financeLinks
      .filter((link) => link.financeOwnerId === userId)
      .map((link) => link.studentId);
    const taughtStudentIds = teacherLinks
      .filter((link) => link.teacherId === userId)
      .map((link) => link.studentId);

    if (financedStudentIds.length > 0) {
      const teachersOfMyStudents = await this.teacherRepo.find({
        where: { studentId: In(financedStudentIds), endedAt: IsNull() },
      });
      for (const link of teachersOfMyStudents) {
        add(link.teacherId, {
          kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER,
          throughUserIds: [link.studentId],
        });
      }
    }

    if (taughtStudentIds.length > 0) {
      const financeOwnersOfMyStudents = await this.financeRepo.find({
        where: { studentId: In(taughtStudentIds), endedAt: IsNull() },
      });
      for (const link of financeOwnersOfMyStudents) {
        add(link.financeOwnerId, {
          kind: RelationKind.TEACHER_OF_STUDENT_OF_FINANCE_OWNER,
          throughUserIds: [link.studentId],
        });
      }
    }

    const names = await this.administrativeProfileLookup.findNamesByUserIds([
      ...relationsByUserId.keys(),
    ]);

    return [...relationsByUserId.entries()]
      .map(([relatedUserId, relations]) => ({
        userId: relatedUserId,
        firstName: names.get(relatedUserId)?.firstName ?? null,
        lastName: names.get(relatedUserId)?.lastName ?? null,
        relations,
      }))
      .sort(byDisplayName);
  }

  // ---------------------------------------------------------------------------
  // Ports consumed by other features (profiles, parent-link-requests, internal)
  // ---------------------------------------------------------------------------
  //
  // These methods are the explicit ports through which other features consume
  // TeacherStudentLink / FinanceOwnerStudentLink / PedagogicalCoordinatorLink
  // capabilities without ever injecting these repositories directly
  // (modules-convention & services-convention: "une feature n'accède qu'aux
  // repositories des entités qu'elle possède").

  /**
   * Read-only port used by ProfilesService.assertReadAccess (PROF-FB-003):
   * a formateur may only read profiles of students they are linked to.
   */
  async isTeacherLinkedToStudent(teacherId: string, studentId: string): Promise<boolean> {
    const link = await this.findActiveTeacherLink(teacherId, studentId);
    return !!link;
  }

  /**
   * Read-only port used by ProfilesService.assertReadAccess (PROF-RA-002):
   * a parent_financeur may only read profiles of students they are linked to.
   */
  async isFinanceOwnerLinkedToStudent(financeOwnerId: string, studentId: string): Promise<boolean> {
    const link = await this.findActiveFinanceLink(financeOwnerId, studentId);
    return !!link;
  }

  /**
   * Lien parent financeur ↔ élève ACTIF, ou `null`. Point unique : « lié » veut
   * dire `endedAt IS NULL`, et cette définition ne doit exister qu'à un seul
   * endroit — un oubli de ce filtre dans une seule requête laisserait un droit
   * ouvert après rupture.
   */
  private findActiveFinanceLink(
    financeOwnerId: string,
    studentId: string,
  ): Promise<FinanceOwnerStudentLink | null> {
    return this.financeRepo.findOne({
      where: { financeOwnerId, studentId, endedAt: IsNull() },
    });
  }

  /**
   * Relation élève ↔ formateur ACTIVE, ou `null`. Point unique, exactement comme
   * `findActiveFinanceLink` : « lié » veut dire `endedAt IS NULL`, et cette
   * définition ne doit exister qu'à UN SEUL endroit — un oubli de ce filtre dans
   * une seule requête laisserait un droit ouvert après la fin de la relation,
   * ce qui viderait de sa substance le point 5 de l'arbitrage du 2026-08-12.
   */
  private findActiveTeacherLink(
    teacherId: string,
    studentId: string,
  ): Promise<TeacherStudentLink | null> {
    return this.teacherRepo.findOne({
      where: { teacherId, studentId, endedAt: IsNull() },
    });
  }

  /**
   * Idempotent port used by ParentLinkRequestsService when a request is
   * approved: creates the finance-owner–student link if it does not exist
   * yet, or returns the existing one. Authorization is already enforced by
   * ParentLinkRequestsService.assertCanProcessRequest, so no actor/role
   * check is repeated here.
   */
  async ensureFinanceOwnerStudentLink(
    financeOwnerId: string,
    studentId: string,
  ): Promise<FinanceOwnerStudentLink> {
    /**
     * « Existe déjà » se lit sur le lien ACTIF : après une rupture, approuver
     * une nouvelle demande de rattachement doit créer une NOUVELLE ligne, et non
     * ressusciter la ligne rompue — qui reste, elle, la preuve de la période
     * passée. C'est ce qui rend le cycle lier → délier → relier possible.
     */
    const existing = await this.findActiveFinanceLink(financeOwnerId, studentId);
    if (existing) return existing;

    const link = this.financeRepo.create({ financeOwnerId, studentId });
    return this.financeRepo.save(link);
  }

  /**
   * System-triggered link creation used by InternalService during account
   * onboarding (no human actor — authorization is enforced upstream by
   * InternalGuard/X-Internal-Secret). Mirrors linkFinanceOwnerToStudent but
   * without a role check or event publication, preserving the existing
   * internal bootstrap contract (409 when the link already exists).
   */
  async createFinanceOwnerStudentLinkForSystem(
    financeOwnerId: string,
    studentId: string,
  ): Promise<FinanceOwnerStudentLink> {
    const existing = await this.findActiveFinanceLink(financeOwnerId, studentId);
    if (existing) {
      throw new ConflictException('This financeur is already linked to this student');
    }

    const link = this.financeRepo.create({ financeOwnerId, studentId });
    return this.financeRepo.save(link);
  }

  /**
   * Création IDEMPOTENTE du lien élève↔formateur demandée par un autre service
   * (aucun acteur humain : l'autorisation est vérifiée en amont par
   * InternalGuard/X-Internal-Secret).
   *
   * Idempotence (besoin du 2026-08-12) : rejouer la validation d'un RP ne doit
   * ni créer un second lien, ni échouer. Le lien existant est donc renvoyé tel
   * quel, et `isCreated` dit à l'appelant lequel des deux cas s'est produit —
   * c'est lui qui porte le code HTTP (201 création / 200 rejeu). Auparavant
   * cette méthode levait un 409 sur doublon, que `teacher-request-service`
   * traitait comme un succès : une erreur métier transformée en succès chez
   * l'appelant, exactement ce que les principes du projet interdisent.
   *
   * Un 409 subsiste, mais sur le SEUL cas qui n'est pas un rejeu : le lien
   * existe avec un statut de professeur principal DIFFÉRENT de celui demandé.
   * Renvoyer un succès en ignorant `isPrincipalTeacher` serait accepter puis
   * jeter un champ en silence (corollaire du 2026-08-09) ; désigner le
   * professeur principal est une opération distincte, avec ses propres règles.
   *
   * L'événement `TeacherLinkedToStudent` est publié ici comme il l'est sur le
   * chemin humain (`linkTeacherToStudent`) : depuis l'arbitrage du 2026-08-12,
   * le lien du flow « demande de professeur » naît de cette route, et non plus
   * d'une action RP directe. Ne pas le publier aurait rendu la création
   * invisible à tout futur abonné (`dashboard-notification-service`).
   * `actorId` est nul : cette route ne transporte pas encore l'identité du RP
   * qui a validé (voir docs/services/profile-service.md, points en suspens).
   */
  async ensureTeacherStudentLinkForSystem(
    teacherId: string,
    studentId: string,
    isPrincipalTeacher = false,
  ): Promise<{ link: TeacherStudentLink; isCreated: boolean }> {
    /**
     * « Existe déjà » se lit sur la relation ACTIVE : après une fin prononcée
     * par le RP, valider une nouvelle demande de professeur doit créer une
     * NOUVELLE ligne, et non ressusciter la ligne terminée — qui reste, elle, la
     * preuve de la période passée. C'est ce qui rend le cycle lier → terminer →
     * relier possible (arbitrage du 2026-08-12, point 6).
     */
    const existing = await this.findActiveTeacherLink(teacherId, studentId);
    if (existing) {
      if (existing.isPrincipalTeacher !== isPrincipalTeacher) {
        throw new ConflictException(
          "Ce formateur est déjà lié à cet élève, avec un statut de professeur principal " +
            "différent de celui demandé. Désigner le professeur principal est une opération " +
            "distincte, que cette route ne réalise pas.",
        );
      }
      return { link: existing, isCreated: false };
    }

    const link = this.teacherRepo.create({ teacherId, studentId, isPrincipalTeacher });
    const saved = await this.teacherRepo.save(link);

    this.events.publish('TeacherLinkedToStudent', {
      teacherId: saved.teacherId,
      studentId: saved.studentId,
      isPrincipalTeacher: saved.isPrincipalTeacher,
      actorId: null,
    });

    return { link: saved, isCreated: true };
  }

  /**
   * System-triggered link creation used by InternalService during account
   * onboarding (no human actor). Mirrors linkPedagogicalCoordinator without a
   * role check or event publication.
   */
  async createPedagogicalCoordinatorLinkForSystem(
    coordinatorId: string,
    studentId: string,
    coordinatorRole: string,
  ): Promise<PedagogicalCoordinatorLink> {
    const existing = await this.coordinatorRepo.findOne({ where: { coordinatorId, studentId } });
    if (existing) {
      throw new ConflictException('This coordinator is already linked to this student');
    }

    const link = this.coordinatorRepo.create({ coordinatorId, studentId, coordinatorRole });
    return this.coordinatorRepo.save(link);
  }

  // ---------------------------------------------------------------------------
  // Response enrichment helpers (name resolution for relation list endpoints)
  // ---------------------------------------------------------------------------

  /**
   * Attaches studentName (firstName/lastName) to each finance-owner→student
   * link, resolved in a single batched query (services-convention: avoid
   * N+1). A student without an administrative profile — or without a
   * firstName/lastName on it — never fails the request: studentName is
   * simply null (link has no administrative profile at all) or
   * { firstName: null, lastName: null } (profile exists, name missing).
   */
  private async attachStudentNames<T extends { studentId: string }>(
    links: T[],
  ): Promise<(T & { studentName: AdministrativeName | null })[]> {
    const names = await this.administrativeProfileLookup.findNamesByUserIds(
      links.map((link) => link.studentId),
    );
    return links.map((link) => ({ ...link, studentName: names.get(link.studentId) ?? null }));
  }

  /**
   * Attaches financeOwnerName (firstName/lastName) to each
   * finance-owner→student link, resolved in a single batched query
   * (services-convention: avoid N+1). Same null-safety guarantee as
   * attachStudentNames.
   */
  private async attachFinanceOwnerNames<T extends { financeOwnerId: string }>(
    links: T[],
  ): Promise<(T & { financeOwnerName: AdministrativeName | null })[]> {
    const names = await this.administrativeProfileLookup.findNamesByUserIds(
      links.map((link) => link.financeOwnerId),
    );
    return links.map((link) => ({ ...link, financeOwnerName: names.get(link.financeOwnerId) ?? null }));
  }

  /**
   * Attache `teacherName` aux liens AP → formateur. Même garantie que les deux
   * helpers ci-dessus : un formateur sans profil administratif ne fait jamais
   * échouer la requête, son nom vaut simplement `null`.
   */
  private async attachTeacherNames<T extends { teacherId: string }>(
    links: T[],
  ): Promise<(T & { teacherName: AdministrativeName | null })[]> {
    const names = await this.administrativeProfileLookup.findNamesByUserIds(
      links.map((link) => link.teacherId),
    );
    return links.map((link) => ({ ...link, teacherName: names.get(link.teacherId) ?? null }));
  }
}

/**
 * Message UNIQUE des deux refus de la rupture : « ce lien n'existe pas » et
 * « ce lien ne vous regarde pas ». Les rendre distinguables reviendrait à
 * répondre « ces deux personnes sont bien liées » à qui n'a pas le droit de le
 * savoir — même règle que `GET /profiles/:userId/statistics`.
 */
export function noFinanceOwnerStudentLinkMessage(): string {
  return 'Aucun lien de financement trouvé entre ces deux personnes';
}

/**
 * Refus de la fin d'une relation élève ↔ formateur quand AUCUNE relation
 * n'existe entre les deux personnes.
 *
 * Contrairement à son équivalent financeur, ce message n'a pas à masquer quoi
 * que ce soit : le contrôle de rôle a déjà écarté les non-RP par un 403, et un
 * RP a de toute façon accès à l'ensemble des relations. Il peut donc être
 * explicite, ce qui rend l'échec exploitable par l'écran.
 */
export function noTeacherStudentLinkMessage(): string {
  return "Aucune relation trouvée entre ce professeur et cet élève";
}

/** Intersection dédoublonnée de deux listes d'identifiants. */
function intersect(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return [...new Set(left.filter((value) => rightSet.has(value)))];
}

/**
 * Tri par nom affichable. Les personnes sans nom saisi passent en dernier :
 * elles ne peuvent être présentées que par un repli, autant ne pas les mettre en
 * tête de liste.
 */
function byDisplayName(left: RelatedPerson, right: RelatedPerson): number {
  const key = (person: RelatedPerson) =>
    `${person.lastName ?? '￿'} ${person.firstName ?? '￿'}`.toLocaleLowerCase('fr');
  return key(left).localeCompare(key(right), 'fr');
}
