import { ApiProperty } from '@nestjs/swagger';

/**
 * Contraintes d'envoi de la photo de profil, LUES par le front AVANT que
 * l'utilisateur ne choisisse un fichier.
 *
 * Raison d'être : sans cette lecture, le front n'a que deux options, toutes
 * deux mauvaises. Soit il n'annonce rien et laisse l'utilisateur découvrir le
 * refus après un envoi de plusieurs secondes ; soit il recopie le plafond en
 * dur, et la valeur diverge du serveur au premier ajustement — c'est-à-dire
 * qu'on annonce une limite fausse, ce qui est pire que ne rien annoncer.
 *
 * Les types Swagger sont déclarés EXPLICITEMENT (`type: Number`, `type: String`,
 * `isArray`). Un `type` déduit par réflexion a déjà empêché ce service de
 * démarrer une fois, le décorateur ne recevant aucun `design:type` exploitable.
 */
export class AvatarConstraintsDto {
  @ApiProperty({
    type: Number,
    example: 1_000_000,
    description:
      'Taille MAXIMALE du fichier envoyé, en octets, mesurée sur les octets reçus avant ' +
      'ré-encodage. Au-delà, POST /profiles/:userId/avatar répond 413 avec le code ' +
      '`UPLOAD_FILE_TOO_LARGE`. Valeur basse aujourd’hui (1 Mo) parce que le reverse-proxy ' +
      'plafonne les corps de requête à 1 Mio ; elle est publiée ici précisément pour que le ' +
      'front ne la code jamais en dur.',
  })
  maxUploadBytes!: number;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    description:
      'Types MIME acceptés en entrée, à reprendre dans l’attribut `accept` du sélecteur de ' +
      'fichier. Indicatifs pour le client seulement : le serveur, lui, détermine le format sur ' +
      'les OCTETS RÉELS et ne consulte jamais le Content-Type annoncé.',
  })
  acceptedContentTypes!: string[];

  @ApiProperty({
    type: String,
    example: 'image/webp',
    description:
      'Type MIME de l’image STOCKÉE puis renvoyée par GET /profiles/:userId/avatar. Toute ' +
      'entrée acceptée est ré-encodée dans ce format, quel que soit le format d’origine.',
  })
  outputContentType!: string;

  @ApiProperty({
    type: Number,
    example: 512,
    description:
      'Côté maximal, en pixels, de l’image produite. Une image plus grande est réduite ; une ' +
      'plus petite n’est jamais agrandie.',
  })
  maxDimensionPixels!: number;
}
