import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * DataSource autonome pour le CLI TypeORM (migration:generate/run/revert).
 * Première introduction de migrations réelles pour ce service — refonte du
 * cahier de texte, 2026-08-20. Même modèle que video-session-service et
 * teacher-request-service (docs/services/video-session-service.md).
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});

export default AppDataSource;
