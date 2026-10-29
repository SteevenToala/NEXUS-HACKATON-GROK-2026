import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { AiModule } from './ai/ai.module';
import { ChatModule } from './chat/chat.module';
import { TelegramModule } from './telegram/telegram.module';
import { LeadsModule } from './leads/leads.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    AiModule,
    ChatModule,
    TelegramModule,
    LeadsModule,
    EnrollmentsModule,
  ],
})
export class AppModule {}
