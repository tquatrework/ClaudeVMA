import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Identifiant fixe de l'unique ligne de réglages (singleton). Table distincte
 * de `pedagogical_log_settings` (pièces jointes) : deux domaines de réglages
 * séparés à l'intérieur du même service, chacun avec son propre singleton —
 * évite qu'une lecture/écriture sur l'un des deux domaines expose ou modifie
 * accidentellement des champs de l'autre.
 */
export const NOTEBOOK_ACCESS_SETTINGS_SINGLETON_ID = '00000000-0000-0000-0000-000000000002';

/**
 * Curseur hiérarchique à trois positions (docs/architecture.md, "Acces
 * administratif et parental au carnet personnel", 2026-08-28, point 1) :
 * `none` < `rp` < `all_admins`. Un curseur plutôt que des cases indépendantes,
 * pour interdire un réglage incohérent ("all_admins" actif mais "rp" inactif).
 */
export enum NotebookAdminAccess {
  NONE = 'none',
  RP = 'rp',
  ALL_ADMINS = 'all_admins',
}

/**
 * NotebookAccessSettings — réglages système, propres à ce service, contrôlant
 * l'accès en LECTURE SEULE d'un tiers au carnet personnel d'un autre
 * utilisateur. Par défaut, personne d'autre que le titulaire n'a accès
 * (comportement inchangé tant que le TI n'a rien activé).
 *
 * Arbitrage du 2026-08-28 (docs/architecture.md, "Acces administratif et
 * parental au carnet personnel — parametrable par le TI, defaut ferme") :
 *   - `adminAccess` : ouvre la lecture de TOUS les carnets personnels au rôle
 *     responsable_pedagogique (`rp`), puis en plus à administrateur_financier
 *     et technicien_informatique (`all_admins`).
 *   - `parentAccessToOwnChild` : ouvre au parent financeur la lecture du
 *     carnet du SEUL élève auquel il est activement rattaché (relation
 *     finance-owner-student vérifiée à chaque lecture auprès de
 *     profile-service, jamais en cache).
 *
 * Ce réglage n'ouvre JAMAIS l'écriture : créer/supprimer une entrée reste
 * réservé au seul titulaire, dans tous les cas (point 2 de l'arbitrage).
 *
 * Lecture ouverte à tout compte authentifié, écriture réservée au
 * technicien_informatique — même discipline que `PedagogicalLogSettings`.
 */
@Entity('notebook_access_settings')
export class NotebookAccessSettings {
  @PrimaryColumn('uuid')
  id: string;

  /** Curseur hiérarchique d'accès administratif — défaut `none` (fermé). */
  @Column({
    name: 'admin_access',
    type: 'varchar',
    length: 20,
    default: NotebookAdminAccess.NONE,
  })
  adminAccess: NotebookAdminAccess;

  /** Ouvre au parent financeur la lecture du carnet de son enfant — défaut désactivé. */
  @Column({ name: 'parent_access_to_own_child', default: false })
  parentAccessToOwnChild: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
