import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200 })
  check() {
    return { status: 'ok', service: 'pedagogical-log-service', timestamp: new Date().toISOString() };
  }
}
