import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ConversationModule } from './conversation/conversation.module';
import { ContactModule } from './contact/contact.module';
import { IncidentModule } from './incident/incident.module';
import { InternalModule } from './internal/internal.module';
import { HealthModule } from './health/health.module';
import { Conversation } from './conversation/entities/conversation.entity';
import { Message } from './conversation/entities/message.entity';
import { ContactPolicy } from './contact/entities/contact-policy.entity';
import { IncidentThread } from './incident/entities/incident-thread.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Conversation, Message, ContactPolicy, IncidentThread],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    JwtModule.register({ global: true }),
    ConversationModule,
    ContactModule,
    IncidentModule,
    InternalModule,
    HealthModule,
  ],
})
export class AppModule {}
