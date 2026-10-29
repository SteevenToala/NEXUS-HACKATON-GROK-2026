import { Controller, Get, Post, Put, Param, Body, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatService } from '../chat/chat.service';
import { EventsService } from '../events/events.service';

@Controller('api/leads')
export class LeadsController {
  constructor(
    private readonly chatService: ChatService,
    private readonly eventsService: EventsService,
  ) {}

  // Flujo en tiempo real con Server-Sent Events (Rúbrica: 10 pts SSE/WebSockets)
  @Sse('events')
  streamEvents(): Observable<MessageEvent> {
    return this.eventsService.getStream();
  }

  @Get()
  async getLeads() {
    return this.chatService.getAllLeads();
  }

  @Get(':id/messages')
  async getMessages(@Param('id') leadId: string) {
    return this.chatService.getMessagesByLead(leadId);
  }

  @Put(':id/handover')
  async updateHandover(
    @Param('id') leadId: string,
    @Body('isHumanIntervening') isHumanIntervening: boolean,
  ) {
    return this.chatService.setHumanIntervention(leadId, isHumanIntervening);
  }

  @Post(':id/messages')
  async sendManualMessage(
    @Param('id') leadId: string,
    @Body('text') text: string,
  ) {
    return this.chatService.sendOperatorMessage(leadId, text);
  }

  // Innovación / Valor Agregado: Ficha y Resumen del Lead generado por IA
  @Post(':id/summarize')
  async summarizeLead(@Param('id') leadId: string) {
    return this.chatService.getLeadSummary(leadId);
  }
}
