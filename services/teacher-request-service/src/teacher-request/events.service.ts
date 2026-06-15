import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  emit(event: string, payload: Record<string, unknown>): void {
    this.logger.log(JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }));
  }
}
