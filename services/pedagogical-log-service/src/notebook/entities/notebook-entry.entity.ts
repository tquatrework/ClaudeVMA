import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * PersonalNotebookEntry — Carnet personnel privé, un par utilisateur.
 *
 * Généralisé le 2026-08-27 (docs/architecture.md, "Generalisation du carnet
 * personnel a d'autres roles que l'eleve") : ce n'est PAS une extension du
 * carnet élève à d'autres rôles, c'est le MÊME mécanisme répliqué par
 * titulaire. Tout utilisateur authentifié — élève, formateur, animateur
 * pédagogique, et tout rôle futur — possède son propre carnet, strictement
 * privé. Aucune relation métier (parent, formateur, AP, RP) ni aucun rôle
 * administratif (RP, AF, TI) n'y donne accès : c'est la seule exception
 * totale à "les administrateurs voient tout" du projet.
 *
 * PLOG-BR-004 / PLOG-BR-008: séparé des entrées de cahier de texte.
 * PLOG-FB-001 (étendu) : personne d'autre que le titulaire — y compris les
 * administrateurs — n'accède jamais à ces entrées.
 * PLOG-FB-002: ne pas retourner dans les APIs du cahier de texte.
 * XML spec: date + calendarEventId optionnel (lien au calendrier).
 */
@Entity('notebook_entries')
export class NotebookEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID du titulaire — seul cet utilisateur peut lire/écrire, quel que soit son rôle */
  @Column({ name: 'owner_id' })
  ownerId: string;

  /** Contenu de l'entrée (texte libre, formules math si possible) */
  @Column({ type: 'text' })
  content: string;

  /** Titre optionnel */
  @Column({ nullable: true })
  title: string;

  /**
   * Date de l'entrée (manuelle ou issue d'un événement calendrier).
   * XML spec data entity PersonalNotebookEntry: "date".
   */
  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate: Date;

  /**
   * Lien optionnel vers un événement du calendrier.
   * XML spec data entity PersonalNotebookEntry: "calendarEventId?".
   */
  @Column({ name: 'calendar_event_id', nullable: true })
  calendarEventId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
