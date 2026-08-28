import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { NotebookAdminAccess } from '../entities/notebook-access-settings.entity';

export class UpdateNotebookAccessSettingsDto {
  @ApiPropertyOptional({
    enum: NotebookAdminAccess,
    description:
      "Curseur hiérarchique d'accès administratif au carnet personnel : " +
      "'none' (défaut, personne), 'rp' (responsable_pedagogique), " +
      "'all_admins' (+ administrateur_financier, technicien_informatique)",
  })
  @IsOptional()
  @IsEnum(NotebookAdminAccess)
  adminAccess?: NotebookAdminAccess;

  @ApiPropertyOptional({
    description:
      "Ouvre au parent financeur la lecture du carnet personnel du seul élève auquel " +
      'il est activement rattaché (défaut désactivé)',
  })
  @IsOptional()
  @IsBoolean()
  parentAccessToOwnChild?: boolean;
}
