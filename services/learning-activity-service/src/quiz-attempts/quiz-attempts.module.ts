import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizGradingClientService } from './quiz-grading-client.service';
import { QuizAttempt } from './entities/quiz-attempt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuizAttempt]), JwtModule.register({})],
  controllers: [QuizAttemptsController],
  providers: [QuizAttemptsService, QuizGradingClientService],
  exports: [QuizAttemptsService],
})
export class QuizAttemptsModule {}
