import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateParentLinkRequestDto {
  @ApiProperty({
    description: "Identifiant de connexion de l'élève (loginIdentifier) tel que communiqué par la plateforme à la famille.",
    example: 'eleve.dupont.2024',
  })
  @IsString()
  @MinLength(3)
  studentLoginIdentifier: string;
}
