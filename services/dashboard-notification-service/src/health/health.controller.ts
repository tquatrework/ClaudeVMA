import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, type: HealthResponseDto })
  check(): HealthResponseDto {
    const response = new HealthResponseDto();
    response.status = 'ok';
    response.service = 'dashboard-notification-service';
    response.timestamp = new Date().toISOString();
    return response;
  }
}
