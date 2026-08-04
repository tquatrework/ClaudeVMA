import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

interface HealthCheckResponseDto {
  status: string;
  service: string;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check', description: 'Returns service liveness status' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check(): HealthCheckResponseDto {
    return { status: 'ok', service: 'identity-access-service', timestamp: new Date().toISOString() };
  }
}
