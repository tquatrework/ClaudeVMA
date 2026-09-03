import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { TutorialFormat } from '../enums/tutorial-format.enum';
import { TutorialBlock } from './tutorial-block.entity';

/**
 * Tutorial — refonte du 2026-09-03 (docs/architecture.md, "Refonte des
 * Tutos/Vidéos"). Remplace l'ancien modèle (chantier de juin 2026 : couple
 * `tutorialType`/`format` texte-mixte-vidéo, `textContent` en texte brut
 * unique, `imageUrl` scalaire, toujours `DRAFT` à la création quel que soit
 * le rôle, aucune unicité de titre, aucun scoping AP) — reconstruction, pas
 * une migration de données (même principe que la refonte des Exercices,
 * 2026-08-29 : voir la migration `CleanupPreRefonteTutorialData`).
 *
 * Une seule entité, deux formats exclusifs (`format`) : `video` porte
 * `videoUrl`, `post` porte une séquence ordonnée de blocs (`blocks`) — les
 * deux partagent les mêmes métadonnées, le même cycle de validation et les
 * mêmes droits de lecture (arbitrage, point 1).
 *
 * Métadonnées alignées sur `Evaluation`/`Exercise` (point 2) : mêmes noms de
 * champs (`theme`, `tags`, `level`, `difficulty`, `competencies`), `description`
 * étant nouveau pour ce type de contenu.
 *
 * `title` obligatoire, unique par auteur, disambiguation automatique par
 * suffixe "(N)" (point 6) — même mécanisme exact que
 * `Exercise`/`Quiz`/`Evaluation` (2026-09-01) : voir
 * `TutorialsService.resolveUniqueTitle`. Index UNIQUE partiel posé
 * directement ici (table neuve après la migration de nettoyage, pas de
 * risque de collision préexistante à gérer dans une migration séparée,
 * contrairement à `AddExerciseQuizTitleUniqueConstraint1795000000000`).
 */
@Entity('tutorials')
@Index('IDX_tutorial_author_title_unique', ['authorId', 'title'], {
  unique: true,
  where: "status != 'removed'",
})
export class Tutorial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string | null;

  @Column({ nullable: true })
  theme: string | null;

  @Column('text', { array: true, nullable: true })
  tags: string[] | null;

  @Column({ nullable: true })
  level: string | null;

  @Column({ nullable: true })
  difficulty: string | null;

  @Column({ type: 'simple-array', nullable: true })
  competencies: string[] | null;

  @Column({
    type: 'enum',
    enum: TutorialFormat,
  })
  format: TutorialFormat;

  /** URL d'embedding — requis pour format=video, interdit pour format=post (vérifié en service). */
  @Column({ nullable: true })
  videoUrl: string | null;

  /**
   * Référence optionnelle vers un Quizz existant, en fin de tuto (point 5).
   * Aucune contrainte FK SQL (le Quizz peut être créé/retiré indépendamment) ;
   * l'existence est vérifiée à l'écriture côté service
   * (`TutorialsService.assertLinkedQuizExists`), l'exposition en lecture est
   * filtrée par le statut `validated` du Quizz référencé au moment de la
   * lecture (`TutorialsService.toPublicSummary`).
   */
  @Column({ nullable: true })
  linkedQuizId: string | null;

  @Column()
  authorId: string;

  @Column()
  authorRole: string;

  @Column({
    type: 'enum',
    enum: ContentStatus,
    default: ContentStatus.DRAFT,
  })
  status: ContentStatus;

  @Column({ nullable: true })
  shareableLink: string | null;

  @OneToMany(() => TutorialBlock, (block) => block.tutorial, { cascade: true })
  blocks: TutorialBlock[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
