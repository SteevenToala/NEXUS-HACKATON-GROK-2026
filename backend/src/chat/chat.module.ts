import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
