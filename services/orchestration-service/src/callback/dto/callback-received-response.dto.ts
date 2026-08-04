import { ApiProperty } from '@nestjs/swagger';

export class CallbackReceivedResponseDto {
  @ApiProperty({ description: 'Confirme la prise en compte du callback' })
  received: boolean;

  @ApiProperty({ description: 'correlationId associé au callback' })
  correlationId: string;
}
