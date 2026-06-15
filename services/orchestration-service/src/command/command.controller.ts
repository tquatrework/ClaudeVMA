import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommandService } from './command.service';
import { DispatchCommandDto } from './dto/dispatch-command.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('commands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('commands')
export class CommandController {
  constructor(private readonly commandService: CommandService) {}

  @Post()
  @ApiOperation({
    summary: 'Émettre une commande d\'intégration idempotente',
    description: 'Dispatche une commande vers un microservice cible. Idempotent via x-idempotency-key.',
  })
  @ApiResponse({ status: 201, description: 'Commande dispatchée' })
  @ApiResponse({ status: 409, description: 'Clé d\'idempotence déjà utilisée' })
  dispatch(@Body() dto: DispatchCommandDto) {
    return this.commandService.dispatch(dto);
  }
}
