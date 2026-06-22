import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ForumPublic } from '../../common/enums/forum-public.enum';

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

  @ApiPropertyOptional({ description: 'Tags séparés par virgule' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ enum: ForumPublic, description: 'Public cible du forum' })
  @IsOptional()
  @IsEnum(ForumPublic)
  public?: ForumPublic;
}
