import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TutorialBlockCategory } from '../enums/tutorial-block-category.enum';
import { TUTORIAL_BLOCK_CONTENT_MAX_LENGTH, TUTORIAL_IMAGE_BASE64_MAX_LENGTH } from '../tutorial.constants';

/**
 * Bloc de la séquence ordonnée d'un Tutoriel au format `post` — 2 catégories
 * (`text`/`image`, arbitrage du 2026-09-03, révisé le même jour par
 * "Éditeur riche (WYSIWYG) pour les blocs texte du Tutoriel 'post'" : la
 * catégorie `title` est retirée, fusionnée dans `text`). Contrairement à
 * `CreateExercisePartDto`, un bloc de Tutoriel n'a pas de structure d'items
 * imbriqués : `content` porte directement le contenu du bloc texte, sur le
 * même mécanisme d'image en base64 que l'Exercice pour `image`.
 *
 * Les règles structurelles croisées (content requis pour text, imageData
 * requis pour image) sont vérifiées côté service
 * (`TutorialsService.validateBlockDto`/`buildBlockEntities`), pas ici.
 */
export class CreateTutorialBlockDto {
  @ApiProperty({ enum: TutorialBlockCategory, description: 'Catégorie du bloc : texte ou image' })
  @IsEnum(TutorialBlockCategory)
  category: TutorialBlockCategory;

  @ApiPropertyOptional({
    description:
      'Contenu du bloc — requis pour "text". Document structuré opaque produit par l\'éditeur riche front ' +
      '(ex. schéma TipTap/ProseMirror) : ce service ne parse ni n\'interprète ce contenu, il le stocke et le ' +
      "restitue tel quel, seule sa taille est plafonnée. Légende optionnelle (texte simple) pour \"image\".",
    maxLength: TUTORIAL_BLOCK_CONTENT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(TUTORIAL_BLOCK_CONTENT_MAX_LENGTH)
  content?: string;

  @ApiPropertyOptional({
    description:
      "Octets de l'image, encodés en base64 (avec ou sans préfixe data URI) — requis pour category=image, " +
      'ignoré sinon.',
    maxLength: TUTORIAL_IMAGE_BASE64_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(TUTORIAL_IMAGE_BASE64_MAX_LENGTH)
  imageData?: string;

  @ApiPropertyOptional({
    description: "Nom de fichier d'origine fourni par le client — affichage uniquement, pour category=image.",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageOriginalFilename?: string;
}
