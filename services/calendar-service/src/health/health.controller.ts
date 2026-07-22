import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

export interface HealthCheckResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200 })
  check(): HealthCheckResponse {
    return { status: 'ok', service: 'calendar-service', timestamp: new Date().toISOString() };
  }
}
