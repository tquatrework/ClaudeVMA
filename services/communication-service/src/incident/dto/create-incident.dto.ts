import { IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIncidentDto {
  @ApiProperty({ description: 'Target user UUID affected by the incident' })
  @IsUUID()
  targetUserId: string;

  @ApiProperty({
    description: 'Description of the incident',
    example: 'L\'utilisateur ne peut plus se connecter depuis ce matin.',
  })
  @IsString()
  @MinLength(5)
  description: string;
}
