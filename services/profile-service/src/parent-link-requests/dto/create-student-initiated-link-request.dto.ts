import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateStudentInitiatedLinkRequestDto {
  @ApiProperty({
    description:
      "Identifiant de connexion du parent financeur (loginIdentifier) tel que communiqué par la plateforme.",
    example: 'parent.dupont.2024',
  })
  @IsString()
  @MinLength(3)
  parentLoginIdentifier: string;
}
