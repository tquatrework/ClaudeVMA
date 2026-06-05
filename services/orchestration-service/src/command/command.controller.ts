import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommandService } from './command.service';
import { DispatchCommandDto } from './dto/dispatch-command.dto';

@ApiTags('commands')
@ApiBearerAuth()
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
