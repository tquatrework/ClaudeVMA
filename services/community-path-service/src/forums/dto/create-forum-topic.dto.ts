import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Création d'un sujet — arbitrage du 2026-09-04. Le premier message du sujet
 * EST son premier `ForumComment` (pas un champ séparé) : `content` devient
 * le contenu de ce premier commentaire, auteur = créateur du sujet.
 */
export class CreateForumTopicDto {
  @ApiProperty({ description: 'Titre du sujet' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Contenu du premier message du sujet' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
