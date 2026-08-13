import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Lien formateur → élève.
 * PROF-BR-007 : un formateur peut être `isPrincipalTeacher = true` pour un élève.
 * PROF-FB-003 : un formateur ne lit que les profils des élèves auxquels il est lié.
 *
 * METTRE FIN N'EFFACE PAS. Terminer la relation renseigne `endedAt`/`endedBy`,
 * jamais un `DELETE` (arbitrage du 2026-08-12, point 4). Même raisonnement que
 * pour le lien parent financeur (2026-08-11) et le retrait d'un consentement
 * (2026-08-09) : on doit pouvoir prouver que la relation a existé, puis a pris
 * fin, et QUAND. Même si le bouton dit « supprimer » à l'écran, la trace reste.
 * La table est donc un journal : `teacher_student_links` n'est jamais purgée.
 *
 * Conséquence sur l'unicité : la contrainte porte sur le lien ACTIF, pas sur la
 * paire. Un index unique PARTIEL (`WHERE ended_at IS NULL`) autorise autant de
 * relations terminées qu'on veut pour une même paire, tout en interdisant deux
 * relations actives simultanées — c'est ce qui rend la relation RECRÉABLE
 * ensuite par le flow normal de demande de professeur (point 6 du même
 * arbitrage : « un arrêt n'est pas un bannissement »). Une contrainte d'unicité
 * pleine l'interdirait définitivement, exactement le piège du
 * `409 "Consent already signed"` qui portait sur l'existence d'une ligne au lieu
 * de l'état courant.
 */
@Entity('teacher_student_links')
@Index('UQ_teacher_student_links_active', ['teacherId', 'studentId'], {
  unique: true,
  where: '"ended_at" IS NULL',
})
export class TeacherStudentLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'teacher_id' })
  teacherId: string;

  @Column('uuid', { name: 'student_id' })
  studentId: string;

  /** PROF-BR-007 : désigne le professeur principal (référent) de cet élève */
  @Column({ name: 'is_principal_teacher', default: false })
  isPrincipalTeacher: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Date de fin de la relation. `null` = relation ACTIVE : c'est le seul critère
   * lu par toutes les requêtes de ce service (droit de lecture du profil,
   * statistiques, archives via `/internal/relations`). Renseigner cette colonne
   * referme donc tous les droits ouverts par la relation, sans qu'aucun appelant
   * ait à le savoir (point 5 de l'arbitrage).
   */
  @Column('timestamp', { name: 'ended_at', nullable: true })
  endedAt: Date | null;

  /**
   * Qui a mis fin à la relation — nécessairement un RP (point 1 de l'arbitrage :
   * ni le formateur, ni l'élève, ni le parent financeur). Mettre fin à une
   * affectation pédagogique est une action sensible : à défaut d'intégration
   * avec `admin-observability-service` (aucun client vers ce service dans
   * `profile-service` à ce jour), la base garde au minimum l'auteur et
   * l'horodatage.
   */
  @Column('uuid', { name: 'ended_by', nullable: true })
  endedBy: string | null;

  /**
   * Motif de la fin, libre et OPTIONNEL. Le déclencheur est hors logiciel
   * (point 2 de l'arbitrage) : le RP apprend par un appel, un courriel ou plus
   * tard par la messagerie qu'il faut arrêter. Il est donc le seul à pouvoir
   * consigner POURQUOI ; sans ce champ, l'information n'existe nulle part dans
   * le système. Optionnel parce qu'exiger un motif conduirait à des motifs
   * saisis pour la forme, qui valent moins qu'un champ vide assumé.
   */
  @Column('text', { name: 'end_reason', nullable: true })
  endReason: string | null;
}
