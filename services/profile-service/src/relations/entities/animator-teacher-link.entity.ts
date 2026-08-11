import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Rattache un ANIMATEUR PÉDAGOGIQUE (AP) à un FORMATEUR qu'il anime.
 *
 * Pourquoi une table de plus alors que `pedagogical_coordinator_links` existe :
 * cette dernière lie un coordinateur (RP ou AP) à un ÉLÈVE. Aucune table ne
 * portait la relation AP → FORMATEUR, alors que l'arbitrage du 2026-08-11 en
 * fait la clé du droit de lecture de l'AP sur les statistiques et les archives
 * pédagogiques des formateurs qu'il anime. Sans elle, la règle « la relation
 * ouvre le droit » aurait été inapplicable à l'AP : il aurait fallu retomber
 * sur une liste de rôles, exactement ce que l'arbitrage ferme.
 *
 * Un AP peut animer plusieurs formateurs et un formateur être animé par
 * plusieurs AP ; seul le doublon exact est interdit.
 */
@Entity('animator_teacher_links')
@Unique(['animatorId', 'teacherId'])
export class AnimatorTeacherLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** userId de l'animateur pédagogique (rôle `animateur_pedagogique`). */
  @Column('uuid', { name: 'animator_id' })
  animatorId: string;

  /** userId du formateur animé. */
  @Column('uuid', { name: 'teacher_id' })
  teacherId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
