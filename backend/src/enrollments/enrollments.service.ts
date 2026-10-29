import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ParticipantCategory, EnrollmentStatus } from '@prisma/client';
import axios from 'axios';

export interface CreateEnrollmentDto {
  leadId?: string;
  buyerName: string;
  identification: string;
  email?: string;
  phone?: string;
  courseId: string;
  category: ParticipantCategory;
  paymentProofUrl?: string;
  academicCertUrl?: string;
  notes?: string;
}

const COURSE_NAMES: Record<string, string> = {
  'gh-600': 'GitHub Agentic AI (GH-600)',
  'arduino': 'Certificación Arduino & Robótica',
  'python': 'Python 2 (Cisco NetAcad)',
};

const CATEGORY_PRICES: Record<ParticipantCategory, number> = {
  STUDENT_UTA: 40.0,
  TEACHER_UTA: 50.0,
  GENERAL_PUBLIC: 60.0,
};

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly telegramApiUrl = `https://api.telegram.org/bot${this.botToken}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async getAllEnrollments(status?: EnrollmentStatus, courseId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (courseId) where.courseId = courseId;

    return this.prisma.enrollment.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            chatId: true,
            name: true,
            sentimentState: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const all = await this.prisma.enrollment.findMany();

    const total = all.length;
    const approved = all.filter((e) => e.status === EnrollmentStatus.APPROVED);
    const pending = all.filter((e) => e.status === EnrollmentStatus.PENDING_VERIFICATION);
    const rejected = all.filter((e) => e.status === EnrollmentStatus.REJECTED);

    const totalRevenue = approved.reduce((sum, e) => sum + e.amount, 0);
    const pendingRevenue = pending.reduce((sum, e) => sum + e.amount, 0);

    const byCategory = {
      STUDENT_UTA: {
        total: all.filter((e) => e.category === ParticipantCategory.STUDENT_UTA).length,
        approved: approved.filter((e) => e.category === ParticipantCategory.STUDENT_UTA).length,
        amount: approved
          .filter((e) => e.category === ParticipantCategory.STUDENT_UTA)
          .reduce((sum, e) => sum + e.amount, 0),
      },
      TEACHER_UTA: {
        total: all.filter((e) => e.category === ParticipantCategory.TEACHER_UTA).length,
        approved: approved.filter((e) => e.category === ParticipantCategory.TEACHER_UTA).length,
        amount: approved
          .filter((e) => e.category === ParticipantCategory.TEACHER_UTA)
          .reduce((sum, e) => sum + e.amount, 0),
      },
      GENERAL_PUBLIC: {
        total: all.filter((e) => e.category === ParticipantCategory.GENERAL_PUBLIC).length,
        approved: approved.filter((e) => e.category === ParticipantCategory.GENERAL_PUBLIC).length,
        amount: approved
          .filter((e) => e.category === ParticipantCategory.GENERAL_PUBLIC)
          .reduce((sum, e) => sum + e.amount, 0),
      },
    };

    const byCourse = {
      'gh-600': {
        name: COURSE_NAMES['gh-600'],
        count: all.filter((e) => e.courseId === 'gh-600').length,
        approved: approved.filter((e) => e.courseId === 'gh-600').length,
        revenue: approved.filter((e) => e.courseId === 'gh-600').reduce((sum, e) => sum + e.amount, 0),
      },
      arduino: {
        name: COURSE_NAMES['arduino'],
        count: all.filter((e) => e.courseId === 'arduino').length,
        approved: approved.filter((e) => e.courseId === 'arduino').length,
        revenue: approved.filter((e) => e.courseId === 'arduino').reduce((sum, e) => sum + e.amount, 0),
      },
      python: {
        name: COURSE_NAMES['python'],
        count: all.filter((e) => e.courseId === 'python').length,
        approved: approved.filter((e) => e.courseId === 'python').length,
        revenue: approved.filter((e) => e.courseId === 'python').reduce((sum, e) => sum + e.amount, 0),
      },
    };

    return {
      totalEnrollments: total,
      approvedCount: approved.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      totalRevenue,
      pendingRevenue,
      byCategory,
      byCourse,
    };
  }

  async createEnrollment(dto: CreateEnrollmentDto) {
    const courseName = COURSE_NAMES[dto.courseId] || dto.courseId;
    const amount = CATEGORY_PRICES[dto.category] || 40.0;

    const enrollment = await this.prisma.enrollment.create({
      data: {
        leadId: dto.leadId || null,
        buyerName: dto.buyerName,
        identification: dto.identification,
        email: dto.email || null,
        phone: dto.phone || null,
        courseId: dto.courseId,
        courseName,
        category: dto.category,
        amount,
        paymentProofUrl: dto.paymentProofUrl || null,
        academicCertUrl: dto.academicCertUrl || null,
        status: EnrollmentStatus.PENDING_VERIFICATION,
        notes: dto.notes || null,
      },
    });

    // Si viene de un lead, actualizar estado a HOT
    if (dto.leadId) {
      await this.prisma.lead.update({
        where: { id: dto.leadId },
        data: { sentimentState: 'HOT' },
      });
    }

    this.eventsService.emit({ type: 'enrollment:created', data: enrollment });
    return enrollment;
  }

  async updateStatus(
    id: string,
    status: EnrollmentStatus,
    verifiedBy: string = 'Operador CTT-FISEI',
    notes?: string,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: { lead: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    const updated = await this.prisma.enrollment.update({
      where: { id },
      data: {
        status,
        verifiedBy,
        notes: notes !== undefined ? notes : enrollment.notes,
        updatedAt: new Date(),
      },
      include: { lead: true },
    });

    this.eventsService.emit({ type: 'enrollment:updated', data: updated });

    // Notificación automática a Telegram si el lead tiene chatId
    if (enrollment.lead?.chatId && this.botToken) {
      try {
        let telegramText = '';
        if (status === EnrollmentStatus.APPROVED) {
          telegramText = `🎉 *¡Matrícula Aprobada Oficialmente - CTT-FISEI!* 🎉\n\nEstimado/a *${enrollment.buyerName}*, secretaría académica ha verificado tu comprobante de pago y acreditación institucional.\n\n• *Programa:* ${enrollment.courseName}\n• *Arancel Validado:* $${enrollment.amount}.00 USD\n• *Folio de Matrícula:* \`MAT-${enrollment.id.slice(0, 8).toUpperCase()}\`\n• *Estado:* Matrícula 100% activa con convalidación y aval universitario.\n\nRecibirás las credenciales de Zoom y del campus virtual a tu correo. ¡Mucho éxito en tu formación!`;
        } else if (status === EnrollmentStatus.REJECTED) {
          telegramText = `⚠️ *Observación en tu Matrícula - CTT-FISEI*\n\nEstimado/a *${enrollment.buyerName}*, la secretaría académica revisó tus documentos con la siguiente observación:\n\n💬 "${notes || 'El comprobante o certificado requiere verificación adicional'}"\n\nPor favor adjúntanos el documento legible o la corrección por este chat para validar tu cupo de inmediato.`;
        }

        if (telegramText) {
          await axios.post(`${this.telegramApiUrl}/sendMessage`, {
            chat_id: enrollment.lead.chatId,
            text: telegramText,
            parse_mode: 'Markdown',
          });
        }
      } catch (err: any) {
        this.logger.error(`Error enviando notificación Telegram de matrícula: ${err.message}`);
      }
    }

    return updated;
  }

  async sendCheckoutFormPrompt(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead no encontrado');

    const promptText = `📋 *Formulario Oficial de Matrícula y Pago - CTT-FISEI (UTA)*\n\nPara formalizar tu cupo e inscripción con certificación universitaria, por favor remítenos los siguientes datos por este mismo chat:\n\n1️⃣ *Nombre Completo y Número de Cédula*\n2️⃣ *Categoría y Arancel a Aplicar:*\n   • *Estudiante UTA:* $40,00\n   • *Docente / Graduado UTA:* $50,00\n   • *Público General:* $60,00\n3️⃣ *Foto de Comprobante Bancario* (Transferencia o Depósito en Banco del Pacífico / Pichincha)\n\n📌 *Requisito de Comprobación Manual:*\n• *Si eres Estudiante UTA:* Adjunta también una foto de tu *Certificado de Matrícula vigente* o *Carnet Estudiantil*.\n• *Si eres Docente / Graduado UTA:* Adjunta foto de tu *Carnet Docente*, *Acción de Personal* o *Título*.\n• *Si eres Público General:* No requieres certificado académico.\n\n🔗 También puedes realizarlo en línea: https://ctt-talleresfisei.uta.edu.ec/course.php`;

    // 1. Guardar mensaje como HUMAN_AGENT en la conversación
    const savedMsg = await this.prisma.message.create({
      data: {
        leadId: lead.id,
        sender: 'HUMAN_AGENT',
        text: promptText,
      },
    });

    this.eventsService.emit({ type: 'message:created', data: savedMsg });

    // 2. Enviar a Telegram
    if (this.botToken && lead.chatId) {
      try {
        await axios.post(`${this.telegramApiUrl}/sendMessage`, {
          chat_id: lead.chatId,
          text: promptText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📝 Llenar Formulario de Matrícula en Telegram', callback_data: 'iniciar_matricula' }],
            ],
          },
        });
      } catch (err: any) {
        this.logger.error(`Error enviando formulario a Telegram: ${err.message}`);
      }
    }

    return savedMsg;
  }
}
