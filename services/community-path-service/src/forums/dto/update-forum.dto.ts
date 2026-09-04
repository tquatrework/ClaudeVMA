import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNotEmpty, IsArray, ArrayUnique } from 'class-validator';
import { ForumRestrictableRole } from '../../common/enums/forum-restrictable-role.enum';

/**
 * Édition des métadonnées d'un forum — arbitrage du 2026-09-04. Tous les
 * champs sont optionnels (seuls ceux fournis sont modifiés), mais reprennent
 * exactement les mêmes règles de validation que CreateForumDto lorsqu'ils
 * sont fournis (titre non vide notamment). L'image d'illustration n'est pas
 * concernée : elle reste gérée par sa propre route (POST /forums/:id/image).
 */
export class UpdateForumDto {
  @ApiPropertyOptional({ description: 'Titre du forum' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ description: 'Description du forum' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Niveau scolaire ciblé' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Difficulté' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Thème pédagogique' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Compétences visées' })
  @IsOptional()
  @IsString()
  competences?: string;

  @ApiPropertyOptional({ description: 'Tags séparés par virgule, exploitables en recherche' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    enum: ForumRestrictableRole,
    isArray: true,
    description:
      'Rôles autorisés à voir et participer au forum. Tableau vide = ouvert à tous les comptes ' +
      'connectés. Les rôles administratifs (RP, AF, TI) gardent de toute façon un accès illimité.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(ForumRestrictableRole, { each: true })
  allowedRoles?: ForumRestrictableRole[];
}
