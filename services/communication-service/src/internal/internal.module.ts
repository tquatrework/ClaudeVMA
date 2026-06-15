import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { ContactModule } from '../contact/contact.module';

@Module({
  imports: [ContactModule],
  controllers: [InternalController],
})
export class InternalModule {}
