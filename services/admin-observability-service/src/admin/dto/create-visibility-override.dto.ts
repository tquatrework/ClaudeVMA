import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVisibilityOverrideDto {
  @ApiProperty({ description: "Type de la ressource à masquer (ex: 'forum', 'content')" })
  @IsString()
  @IsNotEmpty()
  resourceType: string;

  @ApiProperty({ description: "Identifiant de la ressource à masquer" })
  @IsString()
  @IsNotEmpty()
  resourceId: string;

  @ApiPropertyOptional({ description: "Raison du masquage temporaire" })
  @IsOptional()
  @IsString()
  reason?: string;
}
