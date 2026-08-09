import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateVisibilityPreferenceDto {
  @ApiPropertyOptional({
    description:
      "When true, the student pedagogical profile's specificNeeds and goals are hidden " +
      'from contacts other than the financeur and principal teacher (PROF-FN-004)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hideDifficultiesFromContacts?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, pedagogical comments are restricted to the principal teacher only',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  restrictCommentsToPrincipalTeacher?: boolean;
}
