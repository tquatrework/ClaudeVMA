import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PedagogicalLogModule } from './pedagogical-log/pedagogical-log.module';
import { NotebookModule } from './notebook/notebook.module';
import { MemoModule } from './memo/memo.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { PedagogicalLog } from './pedagogical-log/entities/pedagogical-log.entity';
import { NotebookEntry } from './notebook/entities/notebook-entry.entity';
import { MemoChapter } from './memo/entities/memo-chapter.entity';
import { MemoItem } from './memo/entities/memo-item.entity';
import { ActivityProjection } from './events/entities/activity-projection.entity';
import { ProcessedEvent } from './events/entities/processed-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          PedagogicalLog,
          NotebookEntry,
          MemoChapter,
          MemoItem,
          ActivityProjection,
          ProcessedEvent,
        ],
        // Migrations réelles depuis la refonte du 2026-08-20 (nouvelles colonnes/tables) —
        // synchronize reste réservé aux environnements non-production, migrationsRun
        // s'exécute au boot en dehors des tests (mêmes tests e2e qui font leur propre
        // dataSource.synchronize() sur un schéma jeté).
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: configService.get<string>('NODE_ENV') !== 'test',
      }),
      inject: [ConfigService],
    }),
    PedagogicalLogModule,
    NotebookModule,
    MemoModule,
    HealthModule,
    EventsModule,
  ],
})
export class AppModule {}
