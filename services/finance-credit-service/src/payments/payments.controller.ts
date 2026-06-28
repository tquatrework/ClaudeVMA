import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

// Droits contextuels vérifiés dans le service (le paiement est toujours initié par le
// propriétaire lui-même — ownerId = req.user.id). Aucun rôle fixe requis : tout utilisateur
// authentifié peut initier un paiement pour son propre compte. RolesGuard retiré.
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Initiate a payment',
    description:
      'Create a payment for inscription, subscription, or one-time payment. ' +
      'FIN-AC-001: a confirmed inscription payment upgrades the account to "membre", ' +
      'creates an Invoice and a FinancialArchiveItem, and publishes PaymentConfirmed + InvoiceIssued events. ' +
      'FIN-AC-002: only one active inscription per owner is allowed (409 if duplicate).',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment confirmed — emits PaymentConfirmed + InvoiceIssued events',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 409, description: 'Duplicate inscription payment (FIN-AC-002)' })
  // Droits contextuels vérifiés dans le service (ownerId = req.user.id, pas de restriction de rôle).
  initiatePayment(
    @Body() dto: CreatePaymentDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.paymentsService.initiatePayment(req.user.id, dto, correlationId);
  }
}
