import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ForumsModule } from './forums/forums.module';
import { PathsModule } from './paths/paths.module';
import { HealthModule } from './health/health.module';
import { Forum } from './forums/entities/forum.entity';
import { ForumTopic } from './forums/entities/forum-topic.entity';
import { ForumComment } from './forums/entities/forum-comment.entity';
import { ForumExclusion } from './forums/entities/forum-exclusion.entity';
import { ForumCharterSetting } from './forums/entities/forum-charter-setting.entity';
import { ForumCharterAcceptance } from './forums/entities/forum-charter-acceptance.entity';
import { LearningPath } from './paths/entities/learning-path.entity';
import { PathStep } from './paths/entities/path-step.entity';
import { PathEnrollment } from './paths/entities/path-enrollment.entity';
import { PathProgress } from './paths/entities/path-progress.entity';
import { Certificate } from './paths/entities/certificate.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          Forum,
          ForumTopic,
          ForumComment,
          ForumExclusion,
          ForumCharterSetting,
          ForumCharterAcceptance,
          LearningPath,
          PathStep,
          PathEnrollment,
          PathProgress,
          Certificate,
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    ForumsModule,
    PathsModule,
    HealthModule,
  ],
})
export class AppModule {}
