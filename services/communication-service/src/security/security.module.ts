import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

/**
 * Single place where JWT is configured for the whole service.
 * No other module may call `JwtModule.register`/`registerAsync`:
 * `JwtAuthGuard` relies on the secret configured here.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
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
