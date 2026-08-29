import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { ExercisesService } from './exercises.service';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';

/**
 * Routes internes réservées aux appels interservices (learning-activity-service).
 * Contrat figé — docs/architecture.md, "Refonte des Exercices", points 8 et 10.
 * Jamais exposées par api-gateway. Le front ne doit jamais pouvoir lire une
 * solution d'exercice autrement que via learning-activity-service.
 */
@ApiExcludeController()
@Controller('internal/exercises')
@UseGuards(InternalSecretGuard)
export class InternalExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post(':exerciseId/parts/:partId/solution')
  @HttpCode(HttpStatus.OK)
  async getSolution(@Param('exerciseId') exerciseId: string, @Param('partId') partId: string) {
    const content = await this.exercisesService.getSolutionContentForInternal(exerciseId, partId);
    return { content };
  }

  /**
   * Octets d'une image (bloc OU solution) — jamais de vérification de
   * visibilité ici, le caller (learning-activity-service) a déjà statué sur
   * le droit de révéler cette solution/ce bloc avant de relayer au front.
   */
  @Get('images/:itemId')
  async downloadImage(@Param('itemId') itemId: string, @Res() res: Response) {
    const { item, buffer } = await this.exercisesService.getImageForInternalDownload(itemId);
    res.set({
      'Content-Type': item.imageMimeType ?? 'application/octet-stream',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
