import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ContentStatus } from '../../common/enums/content-status.enum';

export class ValidateContentDto {
  @ApiProperty({
    enum: [ContentStatus.VALIDATED, ContentStatus.REJECTED],
    description: 'Décision de validation : validated ou rejected',
  })
  // `@IsIn`, pas `@IsEnum` : class-validator construit le message d'erreur
  // de `@IsEnum` en filtrant les clés numériques (`isNaN(parseInt(key))`)
  // pour ignorer le mapping inverse des enums TS numériques — mais pour un
  // tableau littéral comme celui-ci, les clés ('0', '1') SONT numériques et
  // se retrouvent donc filtrées, laissant l'énumération valide vide dans le
  // message ("decision must be one of the following values: "), alors que
  // la validation elle-même acceptait déjà correctement 'validated'/'rejected'.
  // `@IsIn` n'a pas ce défaut : le message reprend le tableau tel quel.
  @IsIn([ContentStatus.VALIDATED, ContentStatus.REJECTED])
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
