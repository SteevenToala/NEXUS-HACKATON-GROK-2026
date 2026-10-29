import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService, SentimentType } from '../ai/gemini.service';
import { EventsService } from '../events/events.service';
import axios from 'axios';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly telegramApiUrl = `https://api.telegram.org/bot${this.botToken}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly eventsService: EventsService,
  ) {}

  async handleIncomingMessage(chatId: string, text: string, name?: string): Promise<string | null> {
    // 1. Obtener o crear el Lead
    let lead = await this.prisma.lead.findUnique({
      where: { chatId },
    });

    if (!lead) {
      lead = await this.prisma.lead.create({
        data: {
          chatId,
          name: name || `Lead-${chatId.slice(-4)}`,
          sentimentState: 'NEUTRAL',
          isHumanIntervening: false,
        },
      });
      this.eventsService.emit({ type: 'lead:updated', data: lead });
    } else if (name && lead.name !== name) {
      lead = await this.prisma.lead.update({
        where: { id: lead.id },
        data: { name },
      });
      this.eventsService.emit({ type: 'lead:updated', data: lead });
    }

    // 2. Registrar el mensaje entrante del usuario
    const userMessage = await this.prisma.message.create({
      data: {
        leadId: lead.id,
        sender: 'LEAD',
        text,
      },
    });

    // Notificar en tiempo real por SSE al Dashboard del operador
    this.eventsService.emit({ type: 'message:created', data: userMessage });

    // 3. Verificar si el operador humano tiene el control
    if (lead.isHumanIntervening) {
      this.logger.log(`[Handover Activo] Lead ${lead.name} (${chatId}) en control humano. Inferencia pausada.`);
      return null;
    }

    // 4. Obtener historial para la ventana de contexto
    const history = await this.prisma.message.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const formattedHistory = history.reverse().map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    // 5. Inferencia con Google Gemini
    const { reply, sentiment, autoHandover } = await this.geminiService.generateSalesReply(
      formattedHistory,
      text,
    );

    // 6. Manejo de Seamless Handover automático si la IA lo decide o el usuario está frustrado
    const shouldHandover = autoHandover || sentiment === 'FRUSTRATED';

    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        sentimentState: sentiment as any,
        isHumanIntervening: shouldHandover ? true : lead.isHumanIntervening,
        updatedAt: new Date(),
      },
    });

    // Emitir actualización de estado en tiempo real (termómetro)
    this.eventsService.emit({ type: 'lead:updated', data: updatedLead });

    // 7. Guardar respuesta del bot
    const botMessage = await this.prisma.message.create({
      data: {
        leadId: lead.id,
        sender: 'BOT',
        text: reply,
      },
    });

    this.eventsService.emit({ type: 'message:created', data: botMessage });

    return reply;
  }

  async handleIncomingAudio(
    chatId: string,
    transcription: string,
    reply: string,
    sentiment: SentimentType,
    autoHandover: boolean,
    name?: string,
    mediaUrl?: string,
  ): Promise<string> {
    // 1. Obtener o crear lead
    let lead = await this.prisma.lead.findUnique({ where: { chatId } });
    if (!lead) {
      lead = await this.prisma.lead.create({
        data: {
          chatId,
          name: name || `Lead-${chatId.slice(-4)}`,
          sentimentState: sentiment as any,
          isHumanIntervening: false,
        },
      });
      this.eventsService.emit({ type: 'lead:updated', data: lead });
    } else if (name && lead.name !== name) {
      lead = await this.prisma.lead.update({
        where: { id: lead.id },
        data: { name },
      });
      this.eventsService.emit({ type: 'lead:updated', data: lead });
    }

    // 2. Registrar el mensaje de audio transcrito con mediaUrl para reproducir en dashboard
    const userAudioMsg = await this.prisma.message.create({
      data: {
        leadId: lead.id,
        sender: 'LEAD',
        text: `🎙️ [Nota de voz]: "${transcription}"`,
        mediaUrl: mediaUrl || null,
        mediaType: 'audio',
      },
    });
    this.eventsService.emit({ type: 'message:created', data: userAudioMsg });

    // 3. Si está en control humano, no responder automáticamente
    if (lead.isHumanIntervening) {
      this.logger.log(`[Handover Activo] Lead ${lead.name} (${chatId}) en control humano.`);
      return '';
    }

    // 4. Actualizar estado y posible handover
    const shouldHandover = autoHandover || sentiment === 'FRUSTRATED';
    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        sentimentState: sentiment as any,
        isHumanIntervening: shouldHandover ? true : lead.isHumanIntervening,
        updatedAt: new Date(),
      },
    });
    this.eventsService.emit({ type: 'lead:updated', data: updatedLead });

    // 5. Registrar respuesta del bot
    const botMsg = await this.prisma.message.create({
      data: {
        leadId: lead.id,
        sender: 'BOT',
        text: reply,
      },
    });
    this.eventsService.emit({ type: 'message:created', data: botMsg });

    return reply;
  }

  // =========================================================================
  // MANEJO DE IMÁGENES / FOTOS Y COMPROBANTES DE TELEGRAM
  // =========================================================================
  async handleIncomingImage(
    chatId: string,
    caption: string,
    mediaUrl: string,
    name?: string,
  ): Promise<string> {
    // 1. Obtener o crear lead
    let lead = await this.prisma.lead.findUnique({ where: { chatId } });
    if (!lead) {
      lead = await this.prisma.lead.create({
        data: {
          chatId,
          name: name || `Lead-${chatId.slice(-4)}`,
          sentimentState: 'INTERESTED',
          isHumanIntervening: false,
        },
      });
      this.eventsService.emit({ type: 'lead:updated', data: lead });
    } else if (name && lead.name !== name) {
      lead = await this.prisma.lead.update({
        where: { id: lead.id },
        data: { name },
      });
      this.eventsService.emit({ type: 'lead:updated', data: lead });
    }

    // 2. Registrar el mensaje con imagen visible en dashboard
    const userImgMsg = await this.prisma.message.create({
      data: {
        leadId: lead.id,
        sender: 'LEAD',
        text: caption ? `📷 [Imagen]: ${caption}` : '📷 [Imagen enviada por el usuario]',
        mediaUrl,
        mediaType: 'image',
      },
    });
    this.eventsService.emit({ type: 'message:created', data: userImgMsg });

    // 3. Si está en control humano, no responder automáticamente con el bot
    if (lead.isHumanIntervening) {
      this.logger.log(`[Handover Activo] Lead ${lead.name} (${chatId}) en control humano. Imagen registrada en consola.`);
      return '';
    }

    // 4. Si la IA está activa, responder confirmando recepción
    const isPaymentReceipt = caption.toLowerCase().includes('pago') || caption.toLowerCase().includes('comprobante') || caption.toLowerCase().includes('transferencia');
    const reply = isPaymentReceipt
      ? '✅ He recibido tu comprobante de pago. Un asesor de admisiones del CTT-FISEI lo validará para confirmar tu matrícula.'
      : '📸 He recibido tu imagen. Nuestro equipo académico de admisiones la está revisando para brindarte la atención solicitada.';

    const botMsg = await this.prisma.message.create({
      data: {
        leadId: lead.id,
        sender: 'BOT',
        text: reply,
      },
    });
    this.eventsService.emit({ type: 'message:created', data: botMsg });

    return reply;
  }

  async getAllLeads() {
    return this.prisma.lead.findMany({
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMessagesByLead(leadId: string) {
    return this.prisma.message.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async setHumanIntervention(leadId: string, isHumanIntervening: boolean) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead no encontrado');

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: { isHumanIntervening },
    });

    this.eventsService.emit({ type: 'lead:updated', data: updated });
    return updated;
  }

  async sendOperatorMessage(leadId: string, text: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead no encontrado');

    // 1. Guardar mensaje manual como HUMAN_AGENT
    const savedMessage = await this.prisma.message.create({
      data: {
        leadId: lead.id,
        sender: 'HUMAN_AGENT',
        text,
      },
    });

    this.eventsService.emit({ type: 'message:created', data: savedMessage });

    // 2. Enviar a Telegram bajo la identidad del bot
    try {
      await axios.post(`${this.telegramApiUrl}/sendMessage`, {
        chat_id: lead.chatId,
        text,
      });
    } catch (error: any) {
      this.logger.error(`Error enviando mensaje a Telegram (${lead.chatId}): ${error.message}`);
    }

    return savedMessage;
  }

  // Innovación: Resumen Ejecutivo con IA para el operador
  async getLeadSummary(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead no encontrado');

    const messages = await this.prisma.message.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
      take: 15,
    });

    const formattedHistory = messages.map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    return this.geminiService.generateLeadSummary(formattedHistory);
  }
}
