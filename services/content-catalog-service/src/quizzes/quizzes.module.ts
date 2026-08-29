import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QuizzesController } from './quizzes.controller';
import { InternalQuizzesController } from './internal-quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { QuizImportService } from './quiz-import.service';
import { Quiz } from './entities/quiz.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { ProfileClientModule } from '../common/clients/profile-client.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz, QuizQuestion]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ProfileClientModule,
  ],
  controllers: [QuizzesController, InternalQuizzesController],
  providers: [QuizzesService, QuizImportService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
