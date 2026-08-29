import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * DataSource autonome pour le CLI TypeORM (migration:generate/run/revert).
 * Première introduction de migrations réelles pour ce service — incident de
 * production du 2026-08-29 (`synchronize` tentait d'ajouter des colonnes NOT
 * NULL sur des tables contenant encore des lignes du modèle Exercise
 * pré-refonte). Même modèle que pedagogical-log-service, video-session-service
 * et teacher-request-service (docs/services/content-catalog-service.md).
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});

export default AppDataSource;
