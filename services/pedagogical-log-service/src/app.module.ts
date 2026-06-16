import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PedagogicalLogModule } from './pedagogical-log/pedagogical-log.module';
import { NotebookModule } from './notebook/notebook.module';
import { MemoModule } from './memo/memo.module';
import { HealthModule } from './health/health.module';
import { PedagogicalLog } from './pedagogical-log/entities/pedagogical-log.entity';
import { NotebookEntry } from './notebook/entities/notebook-entry.entity';
import { MemoChapter } from './memo/entities/memo-chapter.entity';
import { MemoItem } from './memo/entities/memo-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [PedagogicalLog, NotebookEntry, MemoChapter, MemoItem],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    PedagogicalLogModule,
    NotebookModule,
    MemoModule,
    HealthModule,
  ],
})
export class AppModule {}
