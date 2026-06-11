import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactPolicy } from './entities/contact-policy.entity';
import { ContactService } from './contact.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContactPolicy])],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
