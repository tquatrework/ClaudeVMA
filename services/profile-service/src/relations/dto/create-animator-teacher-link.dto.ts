import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Rattachement d'un animateur pédagogique à un formateur qu'il anime.
 * C'est cette relation — et elle seule — qui ouvre à l'AP la lecture des
 * statistiques et des archives pédagogiques du formateur (arbitrage du
 * 2026-08-11).
 */
export class CreateAnimatorTeacherLinkDto {
  @ApiProperty({
    description: "UUID du compte animateur pédagogique (rôle `animateur_pedagogique`)",
    example: 'a1b2c3d4-0000-4000-8000-000000000001',
  })
  @IsUUID()
  animatorId: string;

  @ApiProperty({
    description: 'UUID du compte formateur animé',
    example: 'e5f6a7b8-0000-4000-8000-000000000002',
  })
  @IsUUID()
  teacherId: string;
}
