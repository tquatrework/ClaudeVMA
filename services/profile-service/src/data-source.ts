import 'reflect-metadata';
import { config as loadDotEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

loadDotEnv();

/**
 * DataSource utilisée UNIQUEMENT par la CLI TypeORM (migration:run / :revert /
 * :generate). L'application, elle, se connecte via TypeOrmModule.forRootAsync
 * dans app.module.ts.
 *
 * Pourquoi ce fichier existe maintenant, alors que le service s'en passait :
 * jusqu'ici le schéma de profile-service n'était géré ni par des migrations ni
 * par `synchronize` (voir la note de convention dans
 * administrative-profile.entity.ts). Toute évolution de schéma se faisait donc
 * par un ALTER manuel, non tracé et non rejouable sur un autre environnement.
 * Le chantier « profils complets » ajoute 15 colonnes et une table : le faire à
 * la main n'était pas tenable. Le service s'aligne donc sur la convention déjà
 * en place dans identity-access-service (`typeorm -d dist/src/data-source.js`).
 *
 * `synchronize` reste à false, ici comme dans l'application : les migrations
 * sont la seule source de vérité du schéma.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'profile_service_migrations',
  synchronize: false,
  logging: ['error', 'migration', 'schema'],
});

// Un seul export de DataSource dans ce fichier : la CLI TypeORM refuse d'en
// charger plus d'un (« Given data source file must contain only one export of
// DataSource instance »). Ne pas ajouter d'export default en doublon.
