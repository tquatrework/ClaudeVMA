import { IsString, IsNotEmpty, IsOptional, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMemoDto {
  @ApiProperty({ description: 'Contenu du mémo' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ description: 'Titre du mémo' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'UUID de l\'élève concerné' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: 'UUID de l\'activité concernée' })
  @IsOptional()
  @IsUUID()
  activityId?: string;
}
