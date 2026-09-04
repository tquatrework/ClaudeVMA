import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * TypeORM CLI entry point (migration:generate / migration:run / migration:show).
 * Not imported by the running application — AppModule configures its own
 * TypeOrmModule.forRootAsync with the same connection parameters plus
 * `migrationsRun: true` so migrations apply automatically at boot.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});

export default AppDataSource;
