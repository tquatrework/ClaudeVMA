import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Texte du commentaire. Les commentaires ne doivent pas donner la solution.' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({
    description: 'Indique si le commentaire est une indication du propriétaire (tagguée spécifiquement)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isOwnerHint?: boolean;
}
