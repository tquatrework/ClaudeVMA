import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Identifiant fixe de l'unique ligne de cette table.
 *
 * SINGLETON : cette table ne porte jamais plus d'une ligne. Une clé primaire
 * FIXE plutôt qu'un UUID généré évite d'avoir à retenir un identifiant
 * quelconque pour relire le seul réglage qui existe — la lecture est
 * `WHERE id = MEDIA_SETTINGS_SINGLETON_ID`, toujours la même valeur.
 */
export const MEDIA_SETTINGS_SINGLETON_ID = 'avatar-upload';

/**
 * Plafond BAS du plafond réglable — « quelques Ko », pas moins. En dessous,
 * aucune photo réaliste ne passerait, ce qui reviendrait à désactiver la
 * fonctionnalité sans le dire.
 */
export const MEDIA_SETTINGS_MIN_AVATAR_UPLOAD_BYTES = 10_000;

/**
 * Plafond HAUT du plafond réglable, et ceiling STATIQUE de multer.
 *
 * Cette même constante sert à DEUX endroits, volontairement :
 *  1. borne haute de validation de `PATCH /profiles/avatar/settings` — le TI
 *     ne peut pas régler une valeur « absurde » (arbitrage du 2026-08-26) ;
 *  2. `limits.fileSize` de multer dans `ProfileAvatarController`, qui reste
 *     STATIQUE — évalué à la construction du décorateur, avant toute requête,
 *     donc avant qu'un appel asynchrone en base ne soit possible.
 *
 * Cette égalité n'est pas un hasard : elle garantit que multer ne devient
 * JAMAIS le maillon qui coupe avant la vérification dynamique du service
 * (`AvatarService.uploadAvatar`, « second verrou »), quelle que soit la valeur
 * réglée par le TI dans les bornes autorisées — la vérification dynamique
 * reste donc TOUJOURS celle qui décide, et le corps `413` qu'elle produit
 * porte toujours le plafond RÉELLEMENT en vigueur.
 *
 * Valeur alignée sur le plafond DÉCLARÉ de `api-gateway` (10 Mio,
 * `gateway/api-gateway/nginx.conf`) : au-delà, la requête est de toute façon
 * arrêtée par la gateway avant d'atteindre ce service, avec un `413` JSON.
 * `nginx-global` (1 Mio, non déclaré, hors dépôt) reste aujourd'hui le
 * maillon le plus bas de la chaîne — voir docs/routes.md, section « Photo de
 * profil » : régler `maxAvatarUploadBytes` au-delà de son plafond produit le
 * même `413` HTML illisible déjà documenté, tant que ce maillon n'est pas
 * corrigé. Ce n'est pas empêché ici : le réglage reste la décision du TI,
 * seule la conséquence est documentée.
 */
export const MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES = 10_000_000;

/**
 * Réglage système du plafond d'envoi de la photo de profil, réglable par le
 * TI À L'EXÉCUTION (arbitrage du 2026-08-26, point 8 de « Liens et pièces
 * jointes sur une entrée de cahier de texte, et paramètres système
 * associés » — docs/architecture.md).
 *
 * Avant ce chantier, `MEDIA_MAX_UPLOAD_BYTES` était une variable
 * d'environnement STATIQUE, relue uniquement au démarrage du processus : la
 * modifier exigeait un redéploiement. Cette table la remplace comme SOURCE DE
 * VÉRITÉ à l'exécution ; la variable d'environnement devient la seule VALEUR
 * D'AMORÇAGE, posée à la première lecture si aucune ligne n'existe encore
 * (voir `MediaSettingsService.getOrBootstrapSettings`) — jamais une valeur
 * figée après coup.
 */
@Entity('media_settings')
export class MediaSettings {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  /** Plafond courant, en octets, appliqué par `AvatarService.uploadAvatar`. */
  @Column({ name: 'max_avatar_upload_bytes', type: 'integer' })
  maxAvatarUploadBytes: number;

  /** Acteur ayant posé la dernière valeur — `null` pour la ligne d'amorçage. */
  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
