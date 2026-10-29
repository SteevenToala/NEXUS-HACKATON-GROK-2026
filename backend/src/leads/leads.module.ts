import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [LeadsController],
})
export class LeadsModule {}
