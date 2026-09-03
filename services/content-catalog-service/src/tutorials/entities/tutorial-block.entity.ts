import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tutorial } from './tutorial.entity';
import { TutorialBlockCategory } from '../enums/tutorial-block-category.enum';

/**
 * TutorialBlock — bloc ordonné d'un Tutoriel au format `post` (refonte du
 * 2026-09-03, révisée le même jour par "Éditeur riche (WYSIWYG) pour les
 * blocs texte du Tutoriel 'post'"). Contrairement à `ExercisePart`/
 * `ExerciseContentItem` (bloc + items imbriqués), un bloc de Tutoriel EST
 * directement son contenu : pas de table d'items séparée, un simple champ
 * `content` suffit pour `text` (document structuré de l'éditeur riche front,
 * donnée opaque pour ce service — plus du texte brut, la catégorie `title`
 * a été retirée et fusionnée dans `text`), et les mêmes colonnes image que
 * `ExerciseContentItem` pour `image` (mécanisme d'upload/stockage/
 * ré-encodage réutilisé tel quel, inchangé par cette révision).
 *
 * `blockNumber` porte l'ordre explicite de la séquence, plusieurs blocs de
 * chaque catégorie étant possibles et librement entrelacés (arbitrage du
 * 2026-09-03, point 4 : "aucune contrainte de composition minimale [...] un
 * post peut être structuré librement par son auteur").
 */
@Entity('tutorial_blocks')
export class TutorialBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tutorialId: string;

  @ManyToOne(() => Tutorial, (tutorial) => tutorial.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tutorialId' })
  tutorial: Tutorial;

  @Column()
  blockNumber: number;

  @Column({
    type: 'enum',
    enum: TutorialBlockCategory,
  })
  category: TutorialBlockCategory;

  /** Contenu du bloc pour `text` (requis, document structuré opaque), légende optionnelle pour `image`. */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** Nom de fichier original fourni par le client (category=image) — affichage uniquement, jamais un chemin. */
  @Column({ nullable: true })
  imageOriginalFilename: string | null;

  /** Nom de fichier généré côté serveur (UUID, category=image) — identifie le fichier sur le volume dédié (partagé avec l'Exercice). */
  @Column({ nullable: true })
  imageStoredFilename: string | null;

  /** Type MIME de sortie du ré-encodage (category=image, toujours image/webp). */
  @Column({ nullable: true })
  imageMimeType: string | null;

  /** Taille réelle du fichier ré-encodé en octets (category=image). */
  @Column({ type: 'integer', nullable: true })
  imageSizeBytes: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
