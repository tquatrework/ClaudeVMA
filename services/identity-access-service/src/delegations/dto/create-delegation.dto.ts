import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDelegationDto {
  @ApiProperty({ example: 'target-user-uuid', description: 'UUID of the user whose account is being acted upon' })
  @IsUUID()
  targetUserId: string;

  @ApiProperty({
    example: 'Modification du profil administratif',
    description: 'Description of the delegated action to be performed',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  actionDescription: string;

  @ApiPropertyOptional({
    example: 'Blocage détecté côté utilisateur, intervention TI requise',
    description: 'Justification or reason for requesting delegated access',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
