import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNotEmpty, IsString, IsDateString, IsArray, MaxLength } from 'class-validator';
import { IsServerManagedField } from './server-managed-field.validator';

/**
 * Body de PUT /profiles/:userId/administrative.
 *
 * Tous les noms de champs sont en anglais et identiques aux propriétés de
 * l'entité AdministrativeProfile (arbitrage du 2026-08-07). Le ValidationPipe
 * global applique `forbidNonWhitelisted: true` : tout champ absent de ce DTO
 * fait échouer la requête en 400 avec un message explicite, il n'est jamais
 * silencieusement ignoré.
 */
export class UpdateAdministrativeProfileDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Marie' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Dupont' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Date of birth (ISO date)', example: '2005-06-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+33612345678' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description:
      'First address line (street number and name). This is a LINE of the address, ' +
      'not the whole address — use addressLine2 for apartment/floor/building.',
    example: '12 rue de la Paix',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Second address line (apartment, floor…)', example: 'Apt 3B' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '75001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Paris' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'France' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  /**
   * REFUSÉ EN ÉCRITURE (400). Depuis que l'application gère les octets de la
   * photo de profil, `avatarUrl` n'est plus une adresse que l'utilisateur
   * colle : c'est une URL construite par le serveur vers
   * `GET /profiles/:userId/avatar`. L'accepter ici puis l'écraser au prochain
   * envoi reviendrait à absorber un champ en silence.
   */
  @ApiPropertyOptional({
    // `type: String` est OBLIGATOIRE ici. Le type TypeScript déclaré ci-dessous
    // ne peut pas être `never` : `emitDecoratorMetadata` n'émet alors aucun
    // `design:type` exploitable, et @nestjs/swagger interprète ce vide comme une
    // dépendance circulaire — il refuse de construire le document et le service
    // ne démarre pas. Constaté sur la pile réelle le 2026-08-10, invisible en
    // test unitaire comme au build.
    type: String,
    description:
      'LECTURE SEULE — refusé en 400 sur cette route. La photo de profil s’envoie via ' +
      'POST /profiles/:userId/avatar (multipart, champ `file`) et se supprime via ' +
      'DELETE /profiles/:userId/avatar. `avatarUrl` reste lisible dans le bloc ' +
      '`administrative` de GET /profiles/:userId.',
    readOnly: true,
  })
  @IsServerManagedField(
    'La photo de profil s’envoie via POST /profiles/:userId/avatar et se supprime via ' +
      'DELETE /profiles/:userId/avatar.',
  )
  avatarUrl?: string;

  /*
   * `department` SUPPRIMÉ le 2026-08-11 (demande utilisateur). Comme le DTO est
   * en `forbidNonWhitelisted`, un client qui l'enverrait encore reçoit un 400
   * explicite — jamais un champ absorbé en silence.
   */

  @ApiPropertyOptional({ description: 'Personal interests/hobbies', example: ['Musique', 'Randonnée'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passions?: string[];
}
