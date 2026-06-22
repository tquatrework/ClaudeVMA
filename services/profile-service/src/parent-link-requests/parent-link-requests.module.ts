import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ParentLinkRequestsController } from './parent-link-requests.controller';
import { ParentLinkRequestsService } from './parent-link-requests.service';
import { ParentLinkRequest } from './entities/parent-link-request.entity';
import { StudentPedagogicalProfile } from '../profiles/entities/student-pedagogical-profile.entity';
import { FinanceOwnerStudentLink } from '../relations/entities/finance-owner-student-link.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParentLinkRequest, StudentPedagogicalProfile, FinanceOwnerStudentLink]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ParentLinkRequestsController],
  providers: [ParentLinkRequestsService],
  exports: [ParentLinkRequestsService],
})
export class ParentLinkRequestsModule {}
