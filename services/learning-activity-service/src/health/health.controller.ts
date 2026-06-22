import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Retourne le statut de disponibilité du service',
  })
  @ApiResponse({ status: 200, description: 'Service opérationnel' })
  check() {
    return {
      status: 'ok',
      service: 'learning-activity-service',
      timestamp: new Date().toISOString(),
    };
  }
}
