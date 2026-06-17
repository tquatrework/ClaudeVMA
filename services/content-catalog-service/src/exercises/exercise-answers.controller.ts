import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';
import { CreateCorrectionRequestDto } from './dto/create-correction-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/jwt-auth.guard';

@ApiTags('exercise-answers')
@ApiBearerAuth()
@Controller('exercise-answers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExerciseAnswersController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post(':id/correction-requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Demander la correction d\'une réponse',
    description: 'Permet à un élève de demander la correction de sa réponse à un exercice. Une activité non pourvue est créée si aucun correcteur n\'est disponible.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la réponse (exercise-answer)' })
  @ApiResponse({ status: 201, description: 'Demande de correction enregistrée' })
  @ApiResponse({ status: 400, description: 'Correction déjà demandée ou données invalides' })
  @ApiResponse({ status: 403, description: 'Vous ne pouvez corriger que vos propres réponses' })
  @ApiResponse({ status: 404, description: 'Réponse introuvable' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Identifiant de corrélation inter-services' })
  async requestCorrection(
    @Param('id') answerId: string,
    @Body() requestDto: CreateCorrectionRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.exercisesService.requestCorrection(
      answerId,
      requestDto,
      currentUser.id,
      currentUser.role,
    );
  }
}
