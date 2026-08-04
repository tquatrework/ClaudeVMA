import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

export interface HealthResponseDto {
  status: string;
  service: string;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200 })
  check(): HealthResponseDto {
    return { status: 'ok', service: 'teacher-request-service', timestamp: new Date().toISOString() };
  }
}
