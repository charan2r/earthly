import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnvironment } from './config';
import { STORE, MongoStore } from './store';
import { AI, PLACES, VOICE, GemmaService, SerpApiService, ElevenLabsService } from './providers';
import { PublicController, QuestController } from './controllers';
import { GrassQuestService } from './domain';
import { SessionGuard } from './http';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        uri: c.get<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 10000,
      }),
    }),
  ],
  controllers: [PublicController, QuestController],
  providers: [
    GrassQuestService,
    SessionGuard,
    { provide: STORE, useClass: MongoStore },
    { provide: AI, useClass: GemmaService },
    { provide: PLACES, useClass: SerpApiService },
    { provide: VOICE, useClass: ElevenLabsService },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
