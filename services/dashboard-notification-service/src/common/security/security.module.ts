import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Single source of truth for JWT configuration in this service.
 * Every feature module that needs JwtService (directly, or transitively
 * through JwtAuthGuard) must import this module instead of registering
 * its own JwtModule instance.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [JwtModule],
})
export class SecurityModule {}
