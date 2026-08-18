/**
 * Application EN LECTURE des réglages de visibilité champ par champ
 * (arbitrage du 2026-08-09, `docs/architecture.md` > « Arbitrages rendus »).
 *
 * Le stockage et le réglage existaient depuis le chantier précédent, mais rien
 * n'était filtré : appliquer la règle supposait de trancher d'abord la
 * contradiction entre le socle « masqué par défaut » et le droit de vue du
 * parent financeur. C'est fait.
 *
 * LA RÈGLE
 * --------
 *  - le TITULAIRE voit toujours l'intégralité de sa fiche, prescription
 *    comprise — un réglage de confidentialité protège des autres, jamais de
 *    soi-même ;
 *  - le PARENT FINANCEUR de l'élève consulté voit tout : « le parent voit tout
 *    ce qui concerne ses élèves, sauf le carnet personnel ». Un élève ne peut
 *    pas masquer une donnée de profil à son parent financeur. Le carnet
 *    personnel appartient à `pedagogical-log-service` et n'est pas concerné
 *    par ce filtrage ;
 *  - les ADMINISTRATEURS voient tout, chacun dans le périmètre de lecture déjà
 *    contrôlé en amont par `assertReadAccess` ;
 *  - les AUTRES CONTACTS LIÉS (aujourd'hui le formateur ; demain élève↔élève)
 *    subissent les réglages.
 *
 * PROFESSEUR PRINCIPAL : non tranché. En l'absence de décision, il subit les
 * réglages comme tout contact lié — le drapeau `isPrincipalTeacher` porté par
 * `TeacherStudentLink` n'est volontairement PAS consulté ici. À rouvrir.
 *
 * `firstName`/`lastName` (depuis le 2026-08-17) : ils ne figurent plus au
 * catalogue de visibilité, ils tombent donc dans la branche « champ absent du
 * catalogue » ci-dessous et sont TOUJOURS renvoyés, quel que soit le lecteur —
 * aucun réglage ne peut plus les masquer.
 *
 * LISIBILITÉ DU MASQUAGE
 * ----------------------
 * Un champ masqué est ABSENT de la réponse, et son nom est listé dans
 * `visibility.hiddenFields`. Jamais de valeur de remplacement : un `null` ou
 * une chaîne vide rendrait « champ masqué » indiscernable de « champ non
 * renseigné », soit exactement l'ambiguïté que ce service passe son temps à
 * résorber. Le consommateur distingue les deux sans deviner :
 *   - clé absente + nom dans `hiddenFields` → masqué par le titulaire ;
 *   - clé présente à `null`                 → non renseigné.
 */

import {
  FIELD_VISIBILITY_CATALOG,
  FieldAudience,
  ProfileBlock,
} from './field-visibility.catalog';

/** Rôle du lecteur vis-à-vis de la fiche consultée. */
export type ViewerRelation =
  /** Le titulaire lui-même : aucun filtrage, prescription comprise. */
  | 'owner'
  /** Parent financeur de l'élève consulté, ou administrateur : aucun filtrage. */
  | 'exempt'
  /** Contact lié soumis aux réglages (formateur aujourd'hui). */
  | 'linked'
  /** Utilisateur authentifié sans lien : ne voit que les champs `all`. */
  | 'authenticated';

/**
 * Champs de STRUCTURE, jamais masqués : ce ne sont pas des données
 * personnelles mais ce qui permet au front de savoir quoi afficher. Les
 * masquer casserait l'affichage sans rien protéger.
 *
 * `isAnimateurPedagogique` en fait partie : c'est un DROIT attribué par le RP
 * (`POST /profiles/:teacherId/ap-status`), pas une déclaration du titulaire, et
 * il n'appartient pas au catalogue de visibilité — donc non réglable, donc non
 * masquable.
 */
export const STRUCTURAL_PROFILE_FIELDS: readonly string[] = [
  'userId',
  'createdAt',
  'updatedAt',
  'isAnimateurPedagogique',
];

/**
 * Métadonnées de la section prescription. Elles ne sont pas au catalogue (donc
 * pas réglables), mais les exposer à un lecteur qui ne voit AUCUN champ de
 * prescription révélerait tout de même qu'un RP a prescrit quelque chose, et
 * quand. Elles suivent donc le sort de la section : visibles dès qu'au moins un
 * champ de prescription du bloc l'est.
 */
export const PRESCRIPTION_METADATA_FIELDS: readonly string[] = ['filledBy', 'filledAt'];

/**
 * Un champ est-il visible pour ce lecteur ?
 *
 * `self`   → titulaire et exemptés seuls ;
 * `linked` → aussi les contacts liés ;
 * `all`    → tout utilisateur authentifié parvenu jusqu'à la lecture.
 */
export function isFieldVisibleTo(audience: FieldAudience, relation: ViewerRelation): boolean {
  if (relation === 'owner' || relation === 'exempt') return true;
  if (audience === 'all') return true;
  if (audience === 'linked') return relation === 'linked';
  return false;
}

/** Noms des champs du catalogue appartenant à un bloc donné. */
function catalogFieldNamesOf(block: ProfileBlock): string[] {
  return FIELD_VISIBILITY_CATALOG.filter((definition) => definition.block === block).map(
    (definition) => definition.fieldName,
  );
}

/** Noms des champs de PRESCRIPTION d'un bloc donné. */
function prescriptionFieldNamesOf(block: ProfileBlock): string[] {
  return FIELD_VISIBILITY_CATALOG.filter(
    (definition) => definition.block === block && definition.isPrescription === true,
  ).map((definition) => definition.fieldName);
}

export interface FilteredBlock<T extends object> {
  /** Copie du bloc privée des champs masqués. */
  block: Partial<T>;
  /** Noms des champs réellement retirés de cette copie. */
  hiddenFieldNames: string[];
}

/**
 * Retire d'un bloc de profil les champs que ce lecteur n'a pas le droit de voir.
 *
 * Ne masque QUE des champs réellement présents sur l'objet : un champ du
 * catalogue qu'aucune colonne ne porte (`comments`, marqué `isReserved`) ne
 * peut pas être « masqué » puisqu'il n'est jamais renvoyé — l'annoncer comme
 * masqué laisserait croire à l'existence d'une donnée cachée.
 */
export function filterProfileBlock<T extends object>(
  source: T,
  block: ProfileBlock,
  audienceByFieldName: ReadonlyMap<string, FieldAudience>,
  relation: ViewerRelation,
): FilteredBlock<T> {
  if (relation === 'owner' || relation === 'exempt') {
    return { block: source, hiddenFieldNames: [] };
  }

  const hiddenFieldNames: string[] = [];
  const visible: Record<string, unknown> = {};
  const carried = source as Record<string, unknown>;

  const catalogFieldNames = new Set(catalogFieldNamesOf(block));

  for (const key of Object.keys(carried)) {
    if (STRUCTURAL_PROFILE_FIELDS.includes(key)) {
      visible[key] = carried[key];
      continue;
    }
    if (PRESCRIPTION_METADATA_FIELDS.includes(key)) {
      continue; // traité après coup, une fois la section prescription évaluée
    }
    if (!catalogFieldNames.has(key)) {
      // Champ porté par l'entité mais absent du catalogue : non réglable, donc
      // non masquable. Le laisser passer plutôt que de le masquer en silence.
      visible[key] = carried[key];
      continue;
    }

    const audience = audienceByFieldName.get(key) ?? 'self';
    if (isFieldVisibleTo(audience, relation)) {
      visible[key] = carried[key];
    } else {
      hiddenFieldNames.push(key);
    }
  }

  const prescriptionFieldNames = prescriptionFieldNamesOf(block);
  const isAnyPrescriptionVisible = prescriptionFieldNames.some((fieldName) =>
    isFieldVisibleTo(audienceByFieldName.get(fieldName) ?? 'self', relation),
  );

  for (const key of PRESCRIPTION_METADATA_FIELDS) {
    if (!(key in carried)) continue;
    if (isAnyPrescriptionVisible) {
      visible[key] = carried[key];
    } else {
      hiddenFieldNames.push(key);
    }
  }

  return { block: visible as Partial<T>, hiddenFieldNames: hiddenFieldNames.sort() };
}

/** Bloc de catalogue correspondant au type de profil pédagogique présent. */
export function pedagogicalBlockOf(pedagogicalType: 'student' | 'teacher'): ProfileBlock {
  return pedagogicalType === 'student' ? 'pedagogical-student' : 'pedagogical-teacher';
}
