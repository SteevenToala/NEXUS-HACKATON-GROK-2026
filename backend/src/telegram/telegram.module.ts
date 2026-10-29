import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { ChatModule } from '../chat/chat.module';
import { AiModule } from '../ai/ai.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [ChatModule, AiModule, EnrollmentsModule],
  controllers: [TelegramController],
})
export class TelegramModule {}
