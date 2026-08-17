import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProfileFieldVisibility } from './entities/profile-field-visibility.entity';
import { UpdateFieldVisibilityDto } from './dto/update-field-visibility.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../common/types/actor.type';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../common/clients/identity-access.client';
import {
  FIELD_VISIBILITY_CATALOG,
  FieldAudience,
  FieldVisibilityDefinition,
  ProfileBlock,
  defaultAudienceOf,
} from './field-visibility.catalog';

/** Une ligne de la réponse de lecture : réglage effectif d'un champ. */
export interface EffectiveFieldVisibility {
  fieldName: string;
  block: ProfileBlock;
  /** Visibilité réellement appliquée : la dérogation si elle existe, sinon le défaut. */
  audience: FieldAudience;
  /** Visibilité du bloc en l'absence de dérogation — utile pour proposer « réinitialiser ». */
  defaultAudience: FieldAudience;
  /** true si l'utilisateur a explicitement réglé ce champ. */
  isExplicit: boolean;
  /** true pour un champ de la section prescription (lu par le titulaire, écrit par le RP). */
  isPrescription: boolean;
  /** true pour un réglage conservé alors qu'aucune colonne ne porte encore la donnée. */
  isReserved: boolean;
}

export interface FieldVisibilityView {
  userId: string;
  fields: EffectiveFieldVisibility[];
}

/**
 * Visibilité champ par champ (docs/proposition-profils.md §8).
 *
 * Extrait de ProfilesService à dessein : celui-ci dépasse déjà largement les
 * seuils de la convention services (>850 lignes, 6 repositories). Ce service
 * possède une seule entité, n'a aucune dépendance vers RelationsService, et
 * répond à une question unique — « qui voit quel champ ».
 */
@Injectable()
export class FieldVisibilityService {
  private readonly logger = new Logger(FieldVisibilityService.name);

  constructor(
    @InjectRepository(ProfileFieldVisibility)
    private readonly fieldVisibilityRepo: Repository<ProfileFieldVisibility>,
    private readonly identityAccessClient: IdentityAccessClient,
  ) {}

  /**
   * Réglages effectifs des champs ADMINISTRABLES pour ce titulaire, dérogations
   * comprises.
   *
   * Filtré par le RÔLE RÉEL du titulaire (arbitrage du 2026-08-17) : le bloc
   * `administrative` est toujours inclus, mais un seul des deux blocs
   * pédagogiques l'est — celui qui correspond au titulaire (élève →
   * `pedagogical-student`, formateur → `pedagogical-teacher`), jamais les deux.
   * Avant cette révision, le catalogue entier était renvoyé sans filtrage : un
   * élève se voyait proposer de régler la visibilité de champs du profil
   * pédagogique FORMATEUR, bug constaté en conditions réelles.
   *
   * La réponse est exhaustive sur le sous-catalogue applicable, et non limitée
   * aux lignes en base : un écran de confidentialité doit pouvoir se construire
   * à partir d'un seul appel. Un champ jamais réglé apparaît avec
   * `isExplicit: false` et sa visibilité par défaut.
   */
  async getFieldVisibility(userId: string, actor: Actor): Promise<FieldVisibilityView> {
    this.assertVisibilityAccess(userId, actor, 'view');

    const catalog = await this.resolveCatalogForTarget(userId);
    const overrides = await this.fieldVisibilityRepo.find({ where: { userId } });
    const audienceByFieldName = new Map(
      overrides.map((override) => [override.fieldName, override.audience]),
    );

    return {
      userId,
      fields: catalog.map((definition) => {
        const explicitAudience = audienceByFieldName.get(definition.fieldName);
        return {
          fieldName: definition.fieldName,
          block: definition.block,
          audience: explicitAudience ?? definition.defaultAudience,
          defaultAudience: definition.defaultAudience,
          isExplicit: explicitAudience !== undefined,
          isPrescription: definition.isPrescription === true,
          isReserved: definition.isReserved === true,
        };
      }),
    };
  }

  /**
   * Upsert partiel des réglages fournis. Les champs non listés sont inchangés.
   *
   * Trois refus explicites, jamais un silence :
   *  - un `fieldName` hors du catalogue APPLICABLE À CE TITULAIRE (hors
   *    catalogue tout court, comme `firstName`/`lastName` retirés le
   *    2026-08-17, OU appartenant au bloc pédagogique de l'AUTRE rôle) → 400,
   *    avec la liste des noms acceptés POUR CE TITULAIRE ;
   *  - un `fieldName` listé deux fois dans le même corps → 400, plutôt que de
   *    laisser le dernier gagner sans que l'appelant le sache.
   * L'audience invalide est déjà rejetée en 400 par le DTO (@IsIn).
   */
  async updateFieldVisibility(
    userId: string,
    dto: UpdateFieldVisibilityDto,
    actor: Actor,
  ): Promise<FieldVisibilityView> {
    this.assertVisibilityAccess(userId, actor, 'update');

    const catalog = await this.resolveCatalogForTarget(userId);
    const knownFieldNames = new Set(catalog.map((definition) => definition.fieldName));
    const sortedKnownFieldNames = [...knownFieldNames].sort();

    const unknownFieldNames = dto.fields
      .map((entry) => entry.fieldName)
      .filter((fieldName) => !knownFieldNames.has(fieldName));

    if (unknownFieldNames.length > 0) {
      throw new BadRequestException(
        `Unknown profile field(s): ${unknownFieldNames.join(', ')}. ` +
          `Accepted field names: ${sortedKnownFieldNames.join(', ')}`,
      );
    }

    const seenFieldNames = new Set<string>();
    const duplicatedFieldNames = new Set<string>();
    for (const entry of dto.fields) {
      if (seenFieldNames.has(entry.fieldName)) {
        duplicatedFieldNames.add(entry.fieldName);
      }
      seenFieldNames.add(entry.fieldName);
    }
    if (duplicatedFieldNames.size > 0) {
      throw new BadRequestException(
        `Duplicated field name(s) in the request body: ${[...duplicatedFieldNames].join(', ')}. ` +
          'Send each field at most once.',
      );
    }

    const existingRows = await this.fieldVisibilityRepo.find({
      where: { userId, fieldName: In([...seenFieldNames]) },
    });
    const rowByFieldName = new Map(existingRows.map((row) => [row.fieldName, row]));

    const rowsToSave = dto.fields.map((entry) => {
      const existing = rowByFieldName.get(entry.fieldName);
      if (existing) {
        existing.audience = entry.audience;
        return existing;
      }
      return this.fieldVisibilityRepo.create({
        userId,
        fieldName: entry.fieldName,
        audience: entry.audience,
      });
    });

    await this.fieldVisibilityRepo.save(rowsToSave);
    return this.getFieldVisibility(userId, actor);
  }

  /**
   * Audience effective d'un champ pour un utilisateur donné.
   *
   * Port de lecture unitaire, conservé pour les vérifications ponctuelles.
   * Le filtrage de `GET /profiles/:userId` passe, lui, par `resolveAudiences`
   * ci-dessous : appeler cette méthode pour chacun des 34 champs du catalogue
   * ferait 34 requêtes là où une seule suffit.
   */
  async resolveAudience(userId: string, fieldName: string): Promise<FieldAudience> {
    const override = await this.fieldVisibilityRepo.findOne({
      where: { userId, fieldName },
    });
    return override?.audience ?? defaultAudienceOf(fieldName);
  }

  /**
   * Audience effective de TOUS les champs du catalogue, en une seule requête.
   *
   * C'est le port consommé par le filtrage en lecture des profils (arbitrage du
   * 2026-08-09). La map est exhaustive — tout champ du catalogue y figure, avec
   * son défaut si l'utilisateur n'a rien réglé — de sorte que l'appelant n'a
   * jamais à retomber sur une valeur implicite pour un champ connu.
   */
  async resolveAudiences(userId: string): Promise<Map<string, FieldAudience>> {
    const overrides = await this.fieldVisibilityRepo.find({ where: { userId } });
    const explicitAudienceByFieldName = new Map(
      overrides.map((override) => [override.fieldName, override.audience]),
    );

    return new Map(
      FIELD_VISIBILITY_CATALOG.map((definition) => [
        definition.fieldName,
        explicitAudienceByFieldName.get(definition.fieldName) ?? definition.defaultAudience,
      ]),
    );
  }

  /**
   * Sous-ensemble du catalogue ADMINISTRABLE pour ce titulaire : le bloc
   * `administrative`, plus le SEUL bloc pédagogique correspondant à son rôle
   * réel (arbitrage du 2026-08-17). Un rôle sans bloc pédagogique connu (RP,
   * AP, TI, AF, parent financeur…) n'a que le bloc administratif.
   */
  private async resolveCatalogForTarget(
    userId: string,
  ): Promise<readonly FieldVisibilityDefinition[]> {
    const pedagogicalBlock = await this.resolveTargetPedagogicalBlock(userId);
    return FIELD_VISIBILITY_CATALOG.filter(
      (definition) => definition.block === 'administrative' || definition.block === pedagogicalBlock,
    );
  }

  /**
   * Rôle réel du titulaire, traduit en bloc pédagogique du catalogue —
   * `identity-access-service` fait AUTORITÉ sur le rôle (docs/architecture.md,
   * « Propriété du rôle ») : ce service ne tient aucune copie du rôle et ne le
   * devine jamais à partir de la présence d'un profil pédagogique, qui est
   * facultatif et peut n'exister pour personne au moment du réglage.
   *
   *  - `eleve`     → `pedagogical-student`
   *  - `formateur` → `pedagogical-teacher`
   *  - tout autre rôle (parent financeur, RP, AP, TI, AF) → aucun bloc
   *    pédagogique : ces rôles n'ont pas de profil pédagogique à régler.
   *
   * `userId` inconnu de identity-access-service → 404, comme partout ailleurs
   * dans ce service (cohérent avec `assertReadAccess`/`getProfile` de
   * ProfilesService). Si identity-access-service est indisponible, on
   * DÉGRADE vers « aucun bloc pédagogique » plutôt que de deviner : exposer
   * les deux blocs par défaut reproduirait exactement le bug corrigé ici.
   */
  private async resolveTargetPedagogicalBlock(userId: string): Promise<ProfileBlock | null> {
    try {
      const account = await this.identityAccessClient.findAccountByUserId(userId);
      if (account.role === UserRole.ELEVE) return 'pedagogical-student';
      if (account.role === UserRole.FORMATEUR) return 'pedagogical-teacher';
      return null;
    } catch (error) {
      if (error instanceof IdentityAccessNotFoundError) {
        throw new NotFoundException(
          `Aucun compte connu de identity-access-service pour userId=${userId}`,
        );
      }
      if (error instanceof IdentityAccessUnavailableError) {
        this.logger.error(
          `Rôle introuvable pour userId=${userId} : identity-access-service indisponible ou ` +
            `mal configuré (${error.message}). Catalogue de visibilité dégradé au bloc ` +
            'administratif seul plutôt que de deviner le bloc pédagogique.',
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Le titulaire règle sa propre confidentialité. Les rôles administratifs y
   * accèdent au titre de leur domaine (support, correction d'un réglage
   * bloquant) ; toute autre identité est refusée.
   */
  private assertVisibilityAccess(
    userId: string,
    actor: Actor,
    intent: 'view' | 'update',
  ): void {
    if (actor.id === userId) return;

    const privilegedRoles = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (privilegedRoles.includes(actor.role)) return;

    throw new ForbiddenException(
      intent === 'view'
        ? 'You may only view your own field visibility settings'
        : 'You may only update your own field visibility settings',
    );
  }
}
