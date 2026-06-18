import { IsOptional, IsEnum, IsInt, IsDateString, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityStatus } from '../../common/enums/activity-status.enum';

export class UpdateOpenActivityDto {
  @ApiPropertyOptional({ enum: ActivityStatus, description: 'Nouveau statut de l\'activité' })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional({ description: 'Nouvelle date limite' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ description: 'Nouveau quota maximal d\'acceptations' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAcceptances?: number;

  @ApiPropertyOptional({ description: 'Description mise à jour' })
  @IsOptional()
  @IsString()
  description?: string;
}
