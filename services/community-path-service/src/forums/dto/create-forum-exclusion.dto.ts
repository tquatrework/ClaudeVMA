import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateForumExclusionDto {
  @ApiProperty({ description: 'Identifiant de l\'utilisateur à exclure' })
  @IsString()
  @IsNotEmpty()
  excludedUserId: string;

  @ApiPropertyOptional({ description: 'Motif de l\'exclusion' })
  @IsOptional()
  @IsString()
  reason?: string;
}
