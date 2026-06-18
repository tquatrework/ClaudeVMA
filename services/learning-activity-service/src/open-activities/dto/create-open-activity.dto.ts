import { IsString, IsOptional, IsEnum, IsNumber, IsInt, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivitySource } from '../../common/enums/activity-source.enum';
import { RewardType } from '../../common/enums/reward-type.enum';

export class CreateOpenActivityDto {
  @ApiProperty({ description: 'Titre de l\'activité non pourvue' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Description détaillée de l\'activité' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ActivitySource,
    description: 'Origine de l\'activité',
    default: ActivitySource.RP_PRODUCTION,
  })
  @IsOptional()
  @IsEnum(ActivitySource)
  source?: ActivitySource;

  @ApiPropertyOptional({ description: 'Identifiant de la ressource source (exercice, correction…)' })
  @IsOptional()
  @IsString()
  sourceReferenceId?: string;

  @ApiPropertyOptional({
    enum: RewardType,
    description: 'Type de rémunération',
    default: RewardType.PEDAGOGICAL_POINTS,
  })
  @IsOptional()
  @IsEnum(RewardType)
  rewardType?: RewardType;

  @ApiPropertyOptional({ description: 'Montant de la rémunération' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardAmount?: number;

  @ApiPropertyOptional({
    description: 'Nombre maximal d\'acceptations (1 par défaut)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAcceptances?: number;

  @ApiPropertyOptional({ description: 'Date limite d\'acceptation (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}
