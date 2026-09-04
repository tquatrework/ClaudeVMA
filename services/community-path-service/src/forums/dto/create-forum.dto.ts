import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNotEmpty, IsArray, ArrayUnique } from 'class-validator';
import { ForumRestrictableRole } from '../../common/enums/forum-restrictable-role.enum';

export class CreateForumDto {
  @ApiProperty({ description: 'Titre du forum' })
  @IsString()
  @IsNotEmpty()
  title: string;

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
      'Rôles autorisés à voir et participer au forum. Omis ou vide = ouvert à tous les comptes connectés. ' +
      'Les rôles administratifs (RP, AF, TI) gardent de toute façon un accès illimité.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(ForumRestrictableRole, { each: true })
  allowedRoles?: ForumRestrictableRole[];
}
