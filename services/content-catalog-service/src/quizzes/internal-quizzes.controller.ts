import { Controller, Post, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { GradeQuizDto } from './dto/grade-quiz.dto';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';

/**
 * Route interne réservée aux appels interservices (learning-activity-service).
 * Contrat figé — docs/architecture.md, "Fonctionnalite Quizz", point 9.
 * Jamais exposée par api-gateway.
 */
@ApiExcludeController()
@Controller('internal/quizzes')
@UseGuards(InternalSecretGuard)
export class InternalQuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post(':quizId/grade')
  @HttpCode(HttpStatus.OK)
  async grade(@Param('quizId') quizId: string, @Body() gradeQuizDto: GradeQuizDto) {
    return this.quizzesService.gradeQuiz(quizId, gradeQuizDto);
  }
}
