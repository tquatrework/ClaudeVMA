import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ContentStatus } from '../../common/enums/content-status.enum';

export class ValidateContentDto {
  @ApiProperty({
    enum: [ContentStatus.VALIDATED, ContentStatus.REJECTED],
    description: 'Décision de validation : validated ou rejected',
  })
  @IsEnum([ContentStatus.VALIDATED, ContentStatus.REJECTED])
  decision: ContentStatus.VALIDATED | ContentStatus.REJECTED;

  @ApiPropertyOptional({ description: 'Commentaire justifiant la décision (obligatoire en cas de rejet)' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Clé d\'idempotence' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
