import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200 })
  check(): { status: string; service: string; timestamp: string } {
    return { status: 'ok', service: 'user-profile-service', timestamp: new Date().toISOString() };
  }
}
