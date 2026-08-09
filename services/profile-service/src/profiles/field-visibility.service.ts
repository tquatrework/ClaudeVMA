import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProfileFieldVisibility } from './entities/profile-field-visibility.entity';
import { UpdateFieldVisibilityDto } from './dto/update-field-visibility.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../common/types/actor.type';
import {
  FIELD_VISIBILITY_CATALOG,
  FieldAudience,
  KNOWN_VISIBILITY_FIELD_NAMES,
  ProfileBlock,
  defaultAudienceOf,
  isKnownVisibilityField,
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
  constructor(
    @InjectRepository(ProfileFieldVisibility)
    private readonly fieldVisibilityRepo: Repository<ProfileFieldVisibility>,
  ) {}

  /**
   * Réglages effectifs de TOUS les champs du catalogue, dérogations comprises.
   *
   * La réponse est exhaustive et non pas limitée aux lignes en base : un écran
   * de confidentialité doit pouvoir se construire à partir d'un seul appel,
   * sans avoir à connaître le catalogue ni les défauts côté front. Un champ
   * jamais réglé apparaît avec `isExplicit: false` et sa visibilité par défaut.
   */
  async getFieldVisibility(userId: string, actor: Actor): Promise<FieldVisibilityView> {
    this.assertVisibilityAccess(userId, actor, 'view');

    const overrides = await this.fieldVisibilityRepo.find({ where: { userId } });
    const audienceByFieldName = new Map(
      overrides.map((override) => [override.fieldName, override.audience]),
    );

    return {
      userId,
      fields: FIELD_VISIBILITY_CATALOG.map((definition) => {
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
   * Deux refus explicites, jamais un silence :
   *  - un `fieldName` hors catalogue → 400, avec la liste des noms acceptés ;
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

    const unknownFieldNames = dto.fields
      .map((entry) => entry.fieldName)
      .filter((fieldName) => !isKnownVisibilityField(fieldName));

    if (unknownFieldNames.length > 0) {
      throw new BadRequestException(
        `Unknown profile field(s): ${unknownFieldNames.join(', ')}. ` +
          `Accepted field names: ${KNOWN_VISIBILITY_FIELD_NAMES.join(', ')}`,
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
