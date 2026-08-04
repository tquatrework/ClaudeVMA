import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CommandService } from './command.service';
import { DispatchCommandDto } from './dto/dispatch-command.dto';
import { CommandResponseDto } from './dto/command-response.dto';
import { JwtAuthGuard } from '../security/jwt-auth.guard';

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
  @ApiResponse({ status: 201, description: 'Commande dispatchée', type: CommandResponseDto })
  @ApiResponse({ status: 409, description: 'Clé d\'idempotence déjà utilisée' })
  async dispatch(@Body() dto: DispatchCommandDto): Promise<CommandResponseDto> {
    const command = await this.commandService.dispatch(dto);
    return CommandResponseDto.fromEntity(command);
  }
}
