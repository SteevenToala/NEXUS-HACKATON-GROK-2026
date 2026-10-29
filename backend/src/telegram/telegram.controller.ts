import { Controller, Post, Body, HttpCode, HttpStatus, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { ChatService } from '../chat/chat.service';
import { GeminiService } from '../ai/gemini.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { ParticipantCategory } from '@prisma/client';
import { CTT_FISEI_COURSES } from '../ai/courses-catalog';

const COURSE_NAMES: Record<string, string> = {
  'gh-600': 'GitHub Agentic AI (GH-600)',
  arduino: 'Certificación Arduino & Robótica',
  python: 'Python 2 (Cisco NetAcad)',
};

interface TelegramEnrollmentSession {
  step: 'CHOOSE_COURSE' | 'CHOOSE_CATEGORY' | 'AWAIT_DATA' | 'AWAIT_PAYMENT_PROOF' | 'AWAIT_ACADEMIC_CERT';
  courseId?: string;
  courseName?: string;
  category?: ParticipantCategory;
  amount?: number;
  buyerName?: string;
  identification?: string;
  email?: string;
  paymentProofUrl?: string;
  academicCertUrl?: string;
  startedAt: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    caption?: string;
    voice?: { file_id: string; duration: number; mime_type?: string };
    audio?: { file_id: string; duration: number; mime_type?: string };
    photo?: { file_id: string; width: number; height: number; file_size?: number }[];
    document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
    from?: { first_name?: string; username?: string };
  };
  callback_query?: {
    id: string;
    from: { first_name?: string; username?: string };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
}

@Controller('webhook/telegram')
export class TelegramController implements OnModuleInit {
  private readonly logger = new Logger(TelegramController.name);
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly telegramApiUrl = `https://api.telegram.org/bot${this.botToken}`;
  private readonly enrollmentSessions = new Map<string, TelegramEnrollmentSession>();

  // Teclado persistente inferior para máxima accesibilidad y usabilidad
  private readonly persistentReplyKeyboard = {
    keyboard: [
      [{ text: '📝 Registrar Matrícula' }, { text: '📚 Cursos CTT-FISEI' }],
      [{ text: '💰 Precios y Descuentos' }, { text: '💳 ¿Cómo Pagar?' }],
      [{ text: '🧑‍💼 Hablar con Asesor' }, { text: '🔄 Menú Principal' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };

  constructor(
    private readonly chatService: ChatService,
    private readonly geminiService: GeminiService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  async onModuleInit() {
    await this.registerBotCommands();
  }

  // Registrar comandos nativos en la interfaz de Telegram
  private async registerBotCommands(): Promise<void> {
    try {
      await axios.post(`${this.telegramApiUrl}/setMyCommands`, {
        commands: [
          { command: 'start', description: 'Menú interactivo y bienvenida' },
          { command: 'matricular', description: 'Formulario oficial de inscripción y matrícula' },
          { command: 'cursos', description: 'Catálogo de cursos y certificaciones' },
          { command: 'precios', description: 'Tarifas oficiales y descuentos UTA' },
          { command: 'horarios', description: 'Fechas, días y horarios de clase' },
          { command: 'pago', description: 'Cuentas bancarias y métodos de pago' },
          { command: 'asesor', description: 'Hablar con un asesor humano en vivo' },
        ],
      });
      this.logger.log('Comandos de Telegram registrados con éxito en Bot API.');
    } catch (err: any) {
      this.logger.warn(`No se pudieron sincronizar comandos en Telegram: ${err.message}`);
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() update: TelegramUpdate): Promise<{ ok: boolean }> {
    // 1. Manejo de Botones Interactivos (Inline Keyboard Callback Queries)
    if (update.callback_query) {
      this.handleCallbackQuery(update.callback_query).catch((err) => {
        this.logger.error(`Error en callback_query: ${err.message}`);
      });
      return { ok: true };
    }

    if (!update.message) {
      return { ok: true };
    }

    const chatId = update.message.chat.id.toString();
    const username = update.message.from?.first_name || update.message.from?.username || 'Prospecto';

    // 2. Manejo de Notas de Voz y Audios
    const voiceOrAudio = update.message.voice || update.message.audio;
    if (voiceOrAudio) {
      this.handleVoiceMessage(chatId, username, voiceOrAudio.file_id, voiceOrAudio.mime_type).catch((err) => {
        this.logger.error(`Error procesando audio de ${chatId}: ${err.message}`);
      });
      return { ok: true };
    }

    // 3. Manejo de Fotos e Imágenes (Comprobantes, capturas)
    if (update.message.photo && update.message.photo.length > 0) {
      const highestRes = update.message.photo[update.message.photo.length - 1];
      this.handlePhotoMessage(chatId, username, highestRes.file_id, update.message.caption).catch((err) => {
        this.logger.error(`Error procesando foto de ${chatId}: ${err.message}`);
      });
      return { ok: true };
    }

    // 4. Manejo de Documentos (si se envía imagen como archivo)
    if (update.message.document && (update.message.document.mime_type?.startsWith('image/') || update.message.document.mime_type === 'application/pdf')) {
      this.handlePhotoMessage(chatId, username, update.message.document.file_id, update.message.caption || update.message.document.file_name).catch((err) => {
        this.logger.error(`Error procesando documento de ${chatId}: ${err.message}`);
      });
      return { ok: true };
    }

    // 3. Manejo de Mensajes de Texto
    if (update.message.text) {
      const text = update.message.text.trim();
      const lower = text.toLowerCase();

      // Cancelar formulario si está activo
      if (lower === '/cancelar' || lower === 'cancelar' || lower === 'cancelar matrícula' || lower === 'cancelar matricula') {
        if (this.enrollmentSessions.has(chatId)) {
          this.enrollmentSessions.delete(chatId);
          await this.sendTelegramMessage(
            chatId,
            '❌ Formulario de matrícula cancelado. Puedes reiniciarlo en cualquier momento escribiendo /matricular o desde el menú.',
          );
          return { ok: true };
        }
      }

      // Si el participante está en medio del formulario de matrícula esperando sus datos personales
      const activeSession = this.enrollmentSessions.get(chatId);
      if (activeSession && activeSession.step === 'AWAIT_DATA') {
        await this.handlePersonalDataInput(chatId, text, username, activeSession);
        return { ok: true };
      }

      if (activeSession && activeSession.step === 'AWAIT_PAYMENT_PROOF') {
        const isDataCorrection =
          lower.includes('corregir') ||
          lower.includes('cambiar nombre') ||
          lower.includes('cambiar cedula') ||
          lower.includes('cambiar cédula') ||
          lower.includes('cambiar datos');

        if (isDataCorrection) {
          activeSession.step = 'AWAIT_DATA';
          activeSession.buyerName = undefined;
          activeSession.identification = undefined;
          this.enrollmentSessions.set(chatId, activeSession);
          await this.sendTelegramMessage(
            chatId,
            `✏️ *Modificación de Datos Personales:*\nPor favor ingresa nuevamente tu Nombre Completo y Cédula (ej: *Steeven Toala, 1804291823*):`,
          );
          return { ok: true };
        }

        const isAskingBank =
          lower.includes('cuenta') ||
          lower.includes('banco') ||
          lower.includes('donde') ||
          lower.includes('dónde') ||
          lower.includes('transferir') ||
          lower.includes('datos');

        if (isAskingBank) {
          await this.sendPaymentInfo(chatId);
          await this.sendTelegramMessage(
            chatId,
            `📸 *Recuerda:* Una vez realizada la transferencia de *$${activeSession.amount}.00 USD*, envía aquí la **foto o captura del comprobante** para continuar.`,
          );
          return { ok: true };
        }

        const keyboard = {
          inline_keyboard: [
            [{ text: '💳 Ver Cuentas Bancarias CTT', callback_data: 'datos_pago_matricula' }],
            [{ text: '✏️ Corregir Mis Datos', callback_data: 'corregir_datos_matricula' }],
            [{ text: '❌ Cancelar Matrícula', callback_data: 'cancelar_matricula' }],
          ],
        };

        await this.sendTelegramMessageWithMarkup(
          chatId,
          `⚠️ *Falta tu Comprobante de Pago (Foto o Captura)*\n\n` +
            `Estimado/a *${activeSession.buyerName}*, para continuar con tu matrícula en *${activeSession.courseName}* requerimos la **imagen o foto** de tu depósito bancario de *$${activeSession.amount}.00 USD* a la cuenta del CTT-FISEI.\n\n` +
            `📸 *Por favor presiona el clip 📎 o cámara 📷 en Telegram y envía la foto de tu comprobante:*`,
          keyboard,
        );
        return { ok: true };
      }

      if (activeSession && activeSession.step === 'AWAIT_ACADEMIC_CERT') {
        const docName =
          activeSession.category === 'STUDENT_UTA'
            ? 'Certificado de Matrícula UTA o Carnet vigente'
            : 'Carnet Docente, Acción de Personal o Título';

        const keyboard = {
          inline_keyboard: [
            [{ text: '🌐 Cambiar a Público General ($60)', callback_data: 'cambiar_publico_general' }],
            [{ text: '❌ Cancelar Matrícula', callback_data: 'cancelar_matricula' }],
          ],
        };

        await this.sendTelegramMessageWithMarkup(
          chatId,
          `⚠️ *Falta tu Respaldo Institucional UTA (Foto o Documento)*\n\n` +
            `Para validar tu arancel con descuento de *$${activeSession.amount}.00 USD*, la Secretaría Académica de la FISEI exige una **foto de tu ${docName}**.\n\n` +
            `💡 *¿No tienes certificado o carnet UTA a la mano?*\n` +
            `Puedes cambiar tu matrícula a **Público General ($60.00 USD)** sin requisito de certificado con el botón abajo:`,
          keyboard,
        );
        return { ok: true };
      }

      // Iniciar Formulario de Matrícula Interactivo en Telegram (el alumno se matricula directamente en el chat)
      const isEnrollmentIntent =
        text === '/matricular' ||
        text === '/inscribirme' ||
        text === '/comprar' ||
        text === '/inscripcion' ||
        lower.includes('matricular') ||
        lower.includes('matricul') ||
        lower.includes('inscrib') ||
        lower.includes('inscripci') ||
        lower.includes('formulario') ||
        lower.includes('comprar') ||
        lower.includes('adquirir') ||
        lower.includes('registrar matrícula') ||
        lower.includes('registrar matricula') ||
        lower.includes('quiero pagar');

      if (isEnrollmentIntent) {
        await this.startEnrollmentFlow(chatId);
        return { ok: true };
      }

      // Menú de Bienvenida y Reactivación de IA
      if (
        text === '/start' ||
        text === '/ia' ||
        text === '/bot' ||
        lower === 'menu' ||
        lower === 'inicio' ||
        lower === '🔄 menú principal' ||
        lower === 'reiniciar menú' ||
        lower === 'activar ia' ||
        lower === 'reanudar'
      ) {
        // Asegurar que si el lead estaba pausado en control humano, se reanude el asistente IA
        const leads = await this.chatService.getAllLeads();
        const lead = leads.find((l) => l.chatId === chatId);
        if (lead && lead.isHumanIntervening) {
          await this.chatService.setHumanIntervention(lead.id, false);
          this.logger.log(`[Handover] Lead ${lead.name} (${chatId}) reanudó IA autónoma mediante comando.`);
        }
        this.sendInteractiveMenu(chatId, username).catch((err) => {
          this.logger.error(`Error enviando menú interactivo: ${err.message}`);
        });
        return { ok: true };
      }

      // Catálogo de Cursos
      if (text === '/cursos' || lower.includes('catálogo') || lower.includes('catalogo') || lower.includes('cursos ctt-fisei')) {
        this.sendCoursesCatalog(chatId, username).catch((err) => {
          this.logger.error(`Error enviando catálogo: ${err.message}`);
        });
        return { ok: true };
      }

      // Tarifas y Precios
      if (text === '/precios' || lower.includes('precios y descuentos') || lower.includes('aranceles') || lower === 'precios') {
        this.sendPricingInfo(chatId).catch((err) => {
          this.logger.error(`Error enviando precios: ${err.message}`);
        });
        return { ok: true };
      }

      // Horarios y Calendario
      if (text === '/horarios' || lower.includes('horarios y modalidades') || lower === 'horarios' || lower === 'fechas') {
        this.sendScheduleInfo(chatId).catch((err) => {
          this.logger.error(`Error enviando horarios: ${err.message}`);
        });
        return { ok: true };
      }

      // Cuentas y Formas de Pago
      if (text === '/pago' || lower.includes('cómo pagar') || lower.includes('como pagar') || lower === 'pago' || lower === 'banco') {
        this.sendPaymentInfo(chatId).catch((err) => {
          this.logger.error(`Error enviando datos bancarios: ${err.message}`);
        });
        return { ok: true };
      }

      // Transferencia a Asesor Humano (Handover)
      if (text === '/asesor' || lower.includes('hablar con asesor') || lower.includes('asesor humano') || lower === 'humano' || lower === 'asesor') {
        this.handleHumanAdvisorRequest(chatId, username).catch((err) => {
          this.logger.error(`Error solicitando asesor: ${err.message}`);
        });
        return { ok: true };
      }

      // Procesamiento Inteligente de Preguntas Libres con Gemini AI
      this.processIncomingMessage(chatId, text, username).catch((err) => {
        this.logger.error(`Error procesando mensaje de chatId ${chatId}: ${err.message}`);
      });
    }

    return { ok: true };
  }

  // Menú Principal Interactivo con Botones e Inicialización de Teclado Rápido
  private async sendInteractiveMenu(chatId: string, username: string): Promise<void> {
    const welcomeText = 
      `¡Hola, ${username}! 👋\n\n` +
      `Te damos la bienvenida al Centro de Transferencia y Desarrollo de Tecnologías (*CTT-FISEI*) de la *Universidad Técnica de Ambato*.\n\n` +
      `📌 *Nuestras Opciones Disponibles:*\n` +
      `Selecciona un botón interactivo o escribe directamente tu consulta:`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '📝 Registrar Matrícula / Comprar Curso', callback_data: 'iniciar_matricula' },
        ],
        [
          { text: '🤖 1. GitHub Agentic AI (GH-600)', callback_data: 'curso_github' },
        ],
        [
          { text: '⚡ 2. Certificación Arduino & IoT', callback_data: 'curso_arduino' },
        ],
        [
          { text: '🐍 3. Python 2 (Cisco NetAcad)', callback_data: 'curso_python' },
        ],
        [
          { text: '💰 Tarifas y Descuentos UTA', callback_data: 'precios_uta' },
          { text: '📅 Fechas y Horarios', callback_data: 'horarios_todos' },
        ],
        [
          { text: '💳 Cuentas de Pago UTA', callback_data: 'datos_pago' },
          { text: '🧑‍💼 Hablar con Asesor', callback_data: 'solicitar_humano' },
        ],
        [
          { text: '🌐 Portal Oficial CTT-FISEI', url: 'https://ctt-talleresfisei.uta.edu.ec/course.php' },
        ],
      ],
    };

    // Primero enviamos mensaje activando el teclado inferior persistente
    await this.sendTelegramMessageWithMarkup(
      chatId,
      'Menú de navegación rápida activado. Puedes pulsar los botones inferiores en cualquier momento.',
      this.persistentReplyKeyboard,
    );

    // Luego enviamos la tarjeta interactiva con inline buttons
    await this.sendTelegramMessageWithMarkup(chatId, welcomeText, inlineKeyboard);

    // Registrar en base de datos para seguimiento CRM en Dashboard
    await this.chatService.handleIncomingMessage(chatId, '/start (Menú Interactivo)', username);
  }

  // Enviar Catálogo de Cursos
  private async sendCoursesCatalog(chatId: string, username: string): Promise<void> {
    const text = 
      `📚 *Catálogo Oficial de Certificaciones CTT-FISEI*\n` +
      `Universidad Técnica de Ambato • Convocatoria 2026\n\n` +
      `Selecciona el programa de tu interés para conocer pénsum, docente, horarios e inscripción:`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🤖 GitHub Agentic AI (GH-600)', callback_data: 'curso_github' }],
        [{ text: '⚡ Certificación Arduino & Robótica', callback_data: 'curso_arduino' }],
        [{ text: '🐍 Python 2 (Cisco NetAcad)', callback_data: 'curso_python' }],
        [{ text: '⬅️ Volver al Menú Principal', callback_data: 'volver_menu' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, text, keyboard);
  }

  // Enviar Tarifas y Aranceles
  private async sendPricingInfo(chatId: string): Promise<void> {
    const text = 
      `💰 *Estructura Arancelaria Oficial CTT-FISEI (UTA)*\n` +
      `────────────────────────────────\n` +
      `La Universidad Técnica de Ambato ofrece tarifas preferenciales para nuestra comunidad:\n\n` +
      `🎓 *1. Estudiantes de Pregrado UTA:*\n` +
      `💵 *$40,00 USD* (Ahorras un 33%)\n\n` +
      `🏛️ *2. Graduados, Docentes y Empleados UTA:*\n` +
      `💵 *$50,00 USD* (Tarifa institucional)\n\n` +
      `🌐 *3. Profesionales y Público en General:*\n` +
      `💵 *$60,00 USD* (Inversión competitiva)\n\n` +
      `*Todos los cursos incluyen:*\n` +
      `✅ Certificado oficial con horas académicas y código QR institucional.\n` +
      `✅ Acceso a plataformas (Zoom, Teams, GitHub Classroom, Cisco NetAcad).\n` +
      `✅ Material didáctico y soporte directo del instructor.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '💳 Ver Cuentas de Transferencia Bancaria', callback_data: 'datos_pago' }],
        [{ text: '🧑‍💼 Solicitar Asesoría de Pago', callback_data: 'solicitar_humano' }],
        [{ text: '⬅️ Volver a Cursos', callback_data: 'ver_cursos' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, text, keyboard);
  }

  // Enviar Horarios y Calendario
  private async sendScheduleInfo(chatId: string): Promise<void> {
    const text = 
      `📅 *Calendario y Horarios de Capacitación CTT-FISEI*\n` +
      `────────────────────────────────\n\n` +
      `🤖 *GitHub Agentic AI (GH-600):*\n` +
      `• *Modalidad:* Virtual por Zoom (Sincrónico)\n` +
      `• *Carga:* 32 horas (24h sincrónicas + 8h autónomas)\n` +
      `• *Días:* Sábados 14, 21, 28 nov y 5 dic\n` +
      `• *Horario:* 08:00 a 14:00\n\n` +
      `⚡ *Certificación Arduino & Robótica:*\n` +
      `• *Modalidad:* Presencial (Laboratorios FISEI - Campus Huachi)\n` +
      `• *Carga:* 32 horas prácticas\n` +
      `• *Días:* Sábados 14, 21, 28 nov y 5 dic\n` +
      `• *Horario:* 08:00 a 14:00\n\n` +
      `🐍 *Python 2 (Cisco NetAcad):*\n` +
      `• *Modalidad:* Virtual autodidacta (Self-paced) en Cisco NetAcad\n` +
      `• *Carga:* 40 horas académicas\n` +
      `• *Período:* Del 16 de noviembre al 16 de diciembre\n` +
      `• *Flexibilidad:* Estudias a tu ritmo 24/7`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🤖 Inscribirme en GitHub AI', url: 'https://ctt-talleresfisei.uta.edu.ec/curso19.php#inscripcion' }],
        [{ text: '⚡ Inscribirme en Arduino', url: 'https://ctt-talleresfisei.uta.edu.ec/curso20.php#inscripcion' }],
        [{ text: '🐍 Inscribirme en Python 2', url: 'https://ctt-talleresfisei.uta.edu.ec/curso21.php#inscripcion' }],
        [{ text: '⬅️ Volver al Menú', callback_data: 'volver_menu' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, text, keyboard);
  }

  // Enviar Cuentas Bancarias y Métodos de Pago
  private async sendPaymentInfo(chatId: string): Promise<void> {
    const text = 
      `💳 *Datos Bancarios Oficiales para Pago de Inscripción*\n` +
      `────────────────────────────────\n` +
      `Para reservar y confirmar tu cupo, realiza el pago en la cuenta autorizada de la universidad:\n\n` +
      `🏦 *Banco:* Banco del Pacífico\n` +
      `📋 *Tipo de Cuenta:* Cuenta Corriente\n` +
      `🔢 *Número de Cuenta:* 03102434\n` +
      `🏛️ *Titular:* UNIVERSIDAD TÉCNICA DE AMBATO\n` +
      `🆔 *RUC:* 1860001560001\n` +
      `🏷️ *Referencia / Sublínea:* CTT-FISEI Capacitación\n\n` +
      `*Pasos a seguir tras realizar la transferencia:*\n` +
      `1. Guarda el comprobante de transferencia o depósito.\n` +
      `2. Completa el formulario de inscripción oficial adjuntando tu comprobante.\n` +
      `3. Recibirás en tu correo los accesos al aula virtual y confirmación de matrícula.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🧑‍💼 Enviar Comprobante a un Asesor', callback_data: 'solicitar_humano' }],
        [{ text: '🌐 Ir al Formulario de Inscripción', url: 'https://ctt-talleresfisei.uta.edu.ec/course.php' }],
        [{ text: '⬅️ Volver al Menú', callback_data: 'volver_menu' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, text, keyboard);
  }

  // Procesar transferencia humana
  private async handleHumanAdvisorRequest(chatId: string, username: string): Promise<void> {
    const text = 
      `🧑‍💼 *Transferencia a Coordinación Académica CTT-FISEI*\n` +
      `────────────────────────────────\n` +
      `Hemos pausado la atención automática del asistente virtual.\n\n` +
      `El operador de turno en la Facultad de Ingeniería en Sistemas (FISEI) ha sido notificado en tiempo real y te responderá directamente por este chat en breves minutos.\n\n` +
      `💡 *Por favor, déjanos tu consulta:* ¿Qué curso te interesa o qué duda específica deseas resolver?`;

    // Pausar IA y activar Handover en base de datos
    await this.chatService.handleIncomingMessage(chatId, '[Solicitó Asistencia de Operador Humano]', username);
    const leads = await this.chatService.getAllLeads();
    const lead = leads.find((l) => l.chatId === chatId);
    if (lead) {
      await this.chatService.setHumanIntervention(lead.id, true);
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '🔄 Reanudar Asistente Virtual', callback_data: 'volver_ia' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, text, keyboard);
  }

  // Procesar clics en los botones interactivos (Callbacks)
  private async handleCallbackQuery(callbackQuery: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
    const chatId = callbackQuery.message?.chat.id.toString();
    if (!chatId) return;

    const data = callbackQuery.data || '';
    const username = callbackQuery.from?.first_name || 'Prospecto';

    // Detener spinner del botón en Telegram
    try {
      await axios.post(`${this.telegramApiUrl}/answerCallbackQuery`, {
        callback_query_id: callbackQuery.id,
      });
    } catch (e) {}

    let replyText = '';
    let keyboard: any = null;

    if (data === 'curso_github') {
      const c = CTT_FISEI_COURSES[0];
      replyText = 
        `🤖 *${c.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📖 *DESCRIPCIÓN*\n` +
        `Especialízate en flujos de trabajo ágiles con IA, GitHub Actions y Model Context Protocol (MCP).\n\n` +
        `⏱️ *MODALIDAD Y CARGA*\n` +
        `• Formato: ${c.modality}\n` +
        `• Duración: ${c.hours} horas académicas (24h sincrónicas + 8h autónomas)\n\n` +
        `📅 *CALENDARIO Y HORARIOS*\n` +
        `• ${c.schedule}\n\n` +
        `👨‍🏫 *INSTRUCTOR CERTIFICADO*\n` +
        `• ${c.instructors}\n\n` +
        `💰 *INVERSIÓN OFICIAL (CTT-FISEI)*\n` +
        `• Estudiantes de Pregrado UTA: *$40,00 USD*\n` +
        `• Graduados, Docentes y Empleados: *$50,00 USD*\n` +
        `• Público en General: *$60,00 USD*\n\n` +
        `📋 *PÉNSUM DESTACADO*\n` +
        `1. Git corporativo y pull requests colaborativos\n` +
        `2. Automatización CI/CD con GitHub Actions\n` +
        `3. GitHub Copilot y Pair Programming asistido\n` +
        `4. Agentes Autónomos y Model Context Protocol (MCP)\n\n` +
        `✅ *Certificado oficial con validación QR de la Universidad Técnica de Ambato.*`;

      keyboard = {
        inline_keyboard: [
          [{ text: '🔗 Inscribirme en GitHub GH-600', url: c.registrationUrl }],
          [{ text: '💳 Ver Cuentas de Transferencia Bancaria', callback_data: 'datos_pago' }],
          [{ text: '🧑‍💼 Hablar con Asesor Académico', callback_data: 'solicitar_humano' }],
          [{ text: '⬅️ Volver al Catálogo de Cursos', callback_data: 'ver_cursos' }],
        ],
      };
    } else if (data === 'curso_arduino') {
      const c = CTT_FISEI_COURSES[1];
      replyText = 
        `⚡ *${c.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📖 *DESCRIPCIÓN*\n` +
        `Capacitación teórico-práctica en electrónica, circuitos DC, sensores y programación de microcontroladores Arduino.\n\n` +
        `⏱️ *MODALIDAD Y SEDE*\n` +
        `• Formato: ${c.modality} en laboratorios experimentales\n` +
        `• Sede: ${c.location}\n` +
        `• Duración: ${c.hours} horas presenciales prácticas\n\n` +
        `📅 *CALENDARIO Y HORARIOS*\n` +
        `• Sábados 14, 21, 28 de noviembre y 5 de diciembre\n` +
        `• Horario: 08:00 a 14:00 (Sábados intensivos)\n\n` +
        `👨‍🏫 *INSTRUCTORES TITULARES*\n` +
        `• ${c.instructors}\n\n` +
        `💰 *INVERSIÓN OFICIAL (CTT-FISEI)*\n` +
        `• Estudiantes de Pregrado UTA: *$40,00 USD*\n` +
        `• Graduados, Docentes y Empleados: *$50,00 USD*\n` +
        `• Público en General: *$60,00 USD*\n\n` +
        `📋 *PÉNSUM DESTACADO*\n` +
        `1. Leyes eléctricas, multímetro e instrumentación\n` +
        `2. Programación en C++ con Arduino IDE\n` +
        `3. Señales PWM, pines analógicos y comunicación serial\n` +
        `4. Integración de sensores, actuadores y robótica experimental\n\n` +
        `✅ *Certificado avalado por CTT-FISEI con código QR institucional.*`;

      keyboard = {
        inline_keyboard: [
          [{ text: '🔗 Inscribirme en Arduino', url: c.registrationUrl }],
          [{ text: '💳 Ver Cuentas de Transferencia Bancaria', callback_data: 'datos_pago' }],
          [{ text: '🧑‍💼 Hablar con Asesor Académico', callback_data: 'solicitar_humano' }],
          [{ text: '⬅️ Volver al Catálogo de Cursos', callback_data: 'ver_cursos' }],
        ],
      };
    } else if (data === 'curso_python') {
      const c = CTT_FISEI_COURSES[2];
      replyText = 
        `🐍 *${c.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📖 *DESCRIPCIÓN*\n` +
        `Nivel avanzado oficial de Cisco Networking Academy para dominar programación modular y orientada a objetos.\n\n` +
        `⏱️ *MODALIDAD Y PLATAFORMA*\n` +
        `• Formato: ${c.modality}\n` +
        `• Plataforma: Aula oficial Cisco NetAcad\n` +
        `• Duración: ${c.hours} horas académicas\n\n` +
        `📅 *CALENDARIO*\n` +
        `• Del 16 de noviembre al 16 de diciembre de 2026\n` +
        `• Ritmo: 100% flexible a tu propio horario 24/7\n\n` +
        `👨‍🏫 *INSTRUCTOR TITULAR*\n` +
        `• ${c.instructors}\n\n` +
        `💰 *INVERSIÓN OFICIAL (CTT-FISEI)*\n` +
        `• Estudiantes de Pregrado UTA: *$40,00 USD*\n` +
        `• Graduados, Docentes y Empleados: *$50,00 USD*\n` +
        `• Público en General: *$60,00 USD*\n\n` +
        `📋 *PÉNSUM DESTACADO*\n` +
        `1. Paquetes PIP y modularidad de software\n` +
        `2. Procesamiento de cadenas y manejo robusto de excepciones\n` +
        `3. POO: Clases, encapsulación, herencia y polimorfismo\n` +
        `4. Manejo de archivos y preparación para certificación PCAP\n\n` +
        `✅ *Certificación internacional Cisco NetAcad con aval universitario.*`;

      keyboard = {
        inline_keyboard: [
          [{ text: '🔗 Inscribirme en Python 2', url: c.registrationUrl }],
          [{ text: '💳 Ver Cuentas de Transferencia Bancaria', callback_data: 'datos_pago' }],
          [{ text: '🧑‍💼 Hablar con Asesor Académico', callback_data: 'solicitar_humano' }],
          [{ text: '⬅️ Volver al Catálogo de Cursos', callback_data: 'ver_cursos' }],
        ],
      };
    } else if (data === 'precios_uta') {
      replyText = 
        `💰 *ESTRUCTURA ARANCELARIA OFICIAL CTT-FISEI*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Tarifas preferenciales autorizadas por la Universidad Técnica de Ambato:\n\n` +
        `🎓 *1. Estudiantes de Pregrado UTA:*\n` +
        `• Inversión: *$40,00 USD*\n` +
        `• Requisito: Carnet o matrícula activa (33% de subsidio)\n\n` +
        `🏛️ *2. Graduados, Docentes y Empleados UTA:*\n` +
        `• Inversión: *$50,00 USD*\n` +
        `• Tarifa preferencial para la comunidad universitaria\n\n` +
        `🌐 *3. Profesionales y Público en General:*\n` +
        `• Inversión: *$60,00 USD*\n` +
        `• Inversión altamente competitiva en el mercado\n\n` +
        `✅ *Todos los cursos incluyen:*\n` +
        `• Certificado digital de aprobación con validación QR oficial de la UTA.\n` +
        `• Acceso a plataformas (Teams, Zoom, Cisco NetAcad, GitHub Classroom).\n` +
        `• Acreditación de horas académicas válidas para graduación.`;

      keyboard = {
        inline_keyboard: [
          [{ text: '💳 Ver Cuentas de Transferencia Bancaria', callback_data: 'datos_pago' }],
          [{ text: '🧑‍💼 Solicitar Asesoría de Pago', callback_data: 'solicitar_humano' }],
          [{ text: '⬅️ Volver a Cursos', callback_data: 'ver_cursos' }],
        ],
      };
      await this.sendTelegramMessageWithMarkup(chatId, replyText, keyboard);
      return;
    } else if (data === 'iniciar_matricula') {
      await this.startEnrollmentFlow(chatId);
      return;
    } else if (data.startsWith('mat_cur_')) {
      const courseId = data.replace('mat_cur_', '');
      await this.askCategoryStep(chatId, courseId);
      return;
    } else if (data.startsWith('mat_cat_')) {
      const category = data.replace('mat_cat_', '') as ParticipantCategory;
      await this.askPersonalDataStep(chatId, category);
      return;
    } else if (data === 'cancelar_matricula') {
      this.enrollmentSessions.delete(chatId);
      await this.sendTelegramMessage(
        chatId,
        '❌ Formulario de matrícula cancelado. Puedes reiniciarlo en cualquier momento escribiendo /matricular o desde el menú.',
      );
      return;
    } else if (data === 'corregir_datos_matricula') {
      const session = this.enrollmentSessions.get(chatId);
      if (session) {
        session.step = 'AWAIT_DATA';
        session.buyerName = undefined;
        session.identification = undefined;
        this.enrollmentSessions.set(chatId, session);
        await this.sendTelegramMessage(
          chatId,
          '✏️ *Modificación de Datos:* Por favor escribe tu Nombre Completo y Cédula (ej: _Steeven Toala, 1804291823_):',
        );
      }
      return;
    } else if (data === 'cambiar_publico_general') {
      const session = this.enrollmentSessions.get(chatId);
      if (session) {
        session.category = 'GENERAL_PUBLIC';
        session.amount = 60;
        await this.finishEnrollment(chatId, session);
      }
      return;
    } else if (data === 'datos_pago_matricula') {
      await this.sendPaymentInfo(chatId);
      return;
    } else if (data === 'horarios_todos') {
      await this.sendScheduleInfo(chatId);
      return;
    } else if (data === 'datos_pago') {
      await this.sendPaymentInfo(chatId);
      return;
    } else if (data === 'ver_cursos') {
      await this.sendCoursesCatalog(chatId, username);
      return;
    } else if (data === 'solicitar_humano') {
      await this.handleHumanAdvisorRequest(chatId, username);
      return;
    } else if (data === 'volver_ia') {
      // Reanudar agente IA
      const leads = await this.chatService.getAllLeads();
      const lead = leads.find((l) => l.chatId === chatId);
      if (lead) {
        await this.chatService.setHumanIntervention(lead.id, false);
      }
      replyText = '✅ Asistente virtual Gemini reanudado. ¿En qué más puedo orientarte hoy?';
      keyboard = {
        inline_keyboard: [
          [{ text: '📝 Registrar Matrícula', callback_data: 'iniciar_matricula' }],
          [{ text: '📚 Ver Cursos Disponibles', callback_data: 'ver_cursos' }],
          [{ text: '💰 Ver Precios UTA', callback_data: 'precios_uta' }],
        ],
      };
    } else if (data === 'volver_menu') {
      await this.sendInteractiveMenu(chatId, username);
      return;
    }

    if (keyboard) {
      await this.sendTelegramMessageWithMarkup(chatId, replyText, keyboard);
    } else {
      await this.sendTelegramMessage(chatId, replyText);
    }
  }

  // Procesamiento de texto libre con el LLM (Gemini)
  private async processIncomingMessage(chatId: string, text: string, username: string): Promise<void> {
    const botReply = await this.chatService.handleIncomingMessage(chatId, text, username);

    if (botReply) {
      // Adjuntar botones contextuales con acceso directo al formulario interactivo de matrícula en Telegram
      const keyboard = {
        inline_keyboard: [
          [{ text: '📝 Llenar Formulario de Matrícula en Telegram', callback_data: 'iniciar_matricula' }],
          [
            { text: '📚 Ver Cursos', callback_data: 'ver_cursos' },
            { text: '💰 Precios UTA', callback_data: 'precios_uta' },
            { text: '🧑‍💼 Asesor Humano', callback_data: 'solicitar_humano' },
          ],
        ],
      };
      await this.sendTelegramMessageWithMarkup(chatId, botReply, keyboard);
    } else {
      // El prospecto está en modo Handover (atención de operador manual)
      const handoverKeyboard = {
        inline_keyboard: [
          [{ text: '🤖 Reanudar Asistente Virtual IA', callback_data: 'volver_ia' }],
          [{ text: '📚 Ver Cursos CTT-FISEI', callback_data: 'ver_cursos' }],
        ],
      };
      await this.sendTelegramMessageWithMarkup(
        chatId,
        '🧑‍💼 Tu mensaje ha sido transferido a la coordinación académica de la FISEI. Un asesor humano te responderá directamente.\n\n_Si prefieres que el asistente virtual inteligente te responda de inmediato, presiona el botón abajo:_',
        handoverKeyboard,
      );
    }
  }

  private async handleVoiceMessage(
    chatId: string,
    username: string,
    fileId: string,
    mimeType?: string,
  ): Promise<void> {
    try {
      this.logger.log(`[Audio] Descargando archivo de Telegram (file_id: ${fileId}) de ${username} (${chatId})...`);

      // 1. Obtener la ruta de descarga desde Telegram Bot API
      const fileInfoRes = await axios.get(`${this.telegramApiUrl}/getFile`, {
        params: { file_id: fileId },
        timeout: 10000,
      });

      const filePath = fileInfoRes.data?.result?.file_path;
      if (!filePath) {
        throw new Error('Telegram no devolvió la ruta del archivo (file_path ausente)');
      }

      // 2. Descargar los bytes binarios del audio
      const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
      const audioBufferRes = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      const base64Audio = Buffer.from(audioBufferRes.data).toString('base64');
      const resolvedMime = mimeType || (filePath.endsWith('.mp3') ? 'audio/mp3' : 'audio/ogg');

      this.logger.log(`[Audio] Audio descargado (${audioBufferRes.data.byteLength} bytes). Procesando con Gemini...`);

      // 3. Procesar transcripción + respuesta de ventas con Gemini
      const processed = await this.geminiService.processAudioVoiceNote(base64Audio, resolvedMime);

      const audioDataUrl = `data:${resolvedMime};base64,${base64Audio}`;

      // 4. Registrar en base de datos con mediaUrl y emitir SSE al panel de mando
      const botReply = await this.chatService.handleIncomingAudio(
        chatId,
        processed.transcription,
        processed.reply,
        processed.sentiment,
        processed.autoHandover,
        username,
        audioDataUrl,
      );

      // 5. Responder por Telegram si no está en control humano
      if (botReply) {
        const replyWithTranscription = 
          `🎙️ *Nota de voz procesada:*\n` +
          `_«${processed.transcription}»_\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${botReply}`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: '📚 Ver Cursos', callback_data: 'ver_cursos' },
              { text: '💰 Precios UTA', callback_data: 'precios_uta' },
            ],
            [
              { text: '💳 ¿Cómo Pagar?', callback_data: 'datos_pago' },
              { text: '🧑‍💼 Hablar con Asesor', callback_data: 'solicitar_humano' },
            ],
          ],
        };

        await this.sendTelegramMessageWithMarkup(chatId, replyWithTranscription, keyboard);
      }
    } catch (err: any) {
      this.logger.error(`Error procesando nota de voz de ${chatId}: ${err.message}`, err.stack);
      await this.sendTelegramMessage(
        chatId,
        '🎙️ He recibido tu nota de voz. Si no logré escucharla con total claridad, por favor escribe tu duda o selecciona una de las opciones del menú interactivo.',
      );
    }
  }

  private async handlePhotoMessage(
    chatId: string,
    username: string,
    fileId: string,
    caption?: string,
  ): Promise<void> {
    try {
      this.logger.log(`[Foto] Descargando imagen de Telegram (file_id: ${fileId}) de ${username} (${chatId})...`);

      // 1. Obtener la ruta de descarga desde Telegram Bot API
      const fileInfoRes = await axios.get(`${this.telegramApiUrl}/getFile`, {
        params: { file_id: fileId },
        timeout: 10000,
      });

      const filePath = fileInfoRes.data?.result?.file_path;
      if (!filePath) {
        throw new Error('Telegram no devolvió la ruta de la imagen (file_path ausente)');
      }

      // 2. Descargar los bytes binarios de la imagen
      const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
      const imageBufferRes = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });

      const base64Image = Buffer.from(imageBufferRes.data).toString('base64');
      const ext = filePath.split('.').pop()?.toLowerCase() || 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
      const imageDataUrl = `data:${mime};base64,${base64Image}`;

      this.logger.log(`[Foto] Imagen descargada (${imageBufferRes.data.byteLength} bytes). Guardando en base de datos...`);

      // 0. Si hay una sesión de matrícula activa esperando comprobante o certificado
      const session = this.enrollmentSessions.get(chatId);
      if (session) {
        if (session.step === 'AWAIT_PAYMENT_PROOF') {
          session.paymentProofUrl = imageDataUrl;
          await this.chatService.handleIncomingImage(
            chatId,
            'Comprobante de Pago Bancario para Matrícula',
            imageDataUrl,
            username,
          );

          // Si es Público General ($60), no requiere certificado académico
          if (session.category === 'GENERAL_PUBLIC') {
            await this.finishEnrollment(chatId, session);
            return;
          }

          // Si es Estudiante UTA o Docente, pedir el certificado académico correspondiente
          session.step = 'AWAIT_ACADEMIC_CERT';
          this.enrollmentSessions.set(chatId, session);

          const isStudent = session.category === 'STUDENT_UTA';
          const docName = isStudent
            ? 'Certificado de Matrícula UTA vigente o Carnet Estudiantil'
            : 'Carnet Docente, Acción de Personal o Título UTA';

          const certPrompt =
            `💳 *¡Comprobante de pago recibido con éxito!*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🎓 *Paso 4 de 4: Respaldo Institucional UTA*\n` +
            `Al aplicar al arancel de ${isStudent ? 'Estudiante UTA (*$40,00 USD*)' : 'Docente / Graduado (*$50,00 USD*)'}, la Secretaría Académica de la FISEI debe constatar tu condición institucional.\n\n` +
            `📸 *Por favor, ENVÍA AHORA UNA FOTO DE TU ${docName.toUpperCase()} por este chat.*`;

          await this.sendTelegramMessage(chatId, certPrompt);
          return;
        }

        if (session.step === 'AWAIT_ACADEMIC_CERT') {
          session.academicCertUrl = imageDataUrl;
          await this.chatService.handleIncomingImage(
            chatId,
            'Certificado Académico de Respaldo',
            imageDataUrl,
            username,
          );

          await this.finishEnrollment(chatId, session);
          return;
        }
      }

      // 3. Registrar en base de datos con mediaUrl y emitir SSE al panel de mando
      const botReply = await this.chatService.handleIncomingImage(
        chatId,
        caption || '',
        imageDataUrl,
        username,
      );

      // Ofrecer registrar matrícula con ese comprobante
      const keyboard = {
        inline_keyboard: [
          [{ text: '📝 Registrar Matrícula con este Comprobante', callback_data: 'iniciar_matricula' }],
          [{ text: '📚 Ver Cursos CTT-FISEI', callback_data: 'ver_cursos' }],
        ],
      };
      await this.sendTelegramMessageWithMarkup(chatId, botReply || '📸 Imagen recibida y registrada en la secretaría.', keyboard);
    } catch (err: any) {
      this.logger.error(`Error procesando foto de ${chatId}: ${err.message}`, err.stack);
      await this.sendTelegramMessage(
        chatId,
        '📷 He recibido tu comprobante/imagen. Nuestro equipo de coordinación académica la está revisando.',
      );
    }
  }

  // =========================================================================
  // MÉTODOS DEL FLUJO DE MATRÍCULA INTERACTIVO EN TELEGRAM
  // =========================================================================

  private async startEnrollmentFlow(chatId: string, preselectedCourseId?: string): Promise<void> {
    if (preselectedCourseId && COURSE_NAMES[preselectedCourseId]) {
      this.enrollmentSessions.set(chatId, {
        step: 'CHOOSE_CATEGORY',
        courseId: preselectedCourseId,
        courseName: COURSE_NAMES[preselectedCourseId],
        startedAt: Date.now(),
      });
      await this.askCategoryStep(chatId, preselectedCourseId);
      return;
    }

    this.enrollmentSessions.set(chatId, {
      step: 'CHOOSE_COURSE',
      startedAt: Date.now(),
    });

    const text =
      `📝 *FORMULARIO OFICIAL DE MATRÍCULA CTT-FISEI (UTA)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `¡Bienvenido/a al registro oficial de matrícula!\n\n` +
      `📌 *Paso 1 de 4:* Selecciona el programa académico oficial en el que deseas asegurar tu cupo:`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🤖 GitHub Agentic AI (GH-600) • 32h', callback_data: 'mat_cur_gh-600' }],
        [{ text: '⚡ Certificación Arduino & IoT • 32h', callback_data: 'mat_cur_arduino' }],
        [{ text: '🐍 Python 2 (Cisco NetAcad) • 40h', callback_data: 'mat_cur_python' }],
        [{ text: '❌ Cancelar Registro', callback_data: 'cancelar_matricula' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, text, keyboard);
  }

  private async askCategoryStep(chatId: string, courseId: string): Promise<void> {
    const courseName = COURSE_NAMES[courseId] || courseId;
    const session = this.enrollmentSessions.get(chatId) || {
      step: 'CHOOSE_CATEGORY',
      startedAt: Date.now(),
    };
    session.step = 'CHOOSE_CATEGORY';
    session.courseId = courseId;
    session.courseName = courseName;
    this.enrollmentSessions.set(chatId, session);

    const text =
      `📖 *Programa:* *${courseName}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📌 *Paso 2 de 4:* Selecciona tu categoría para aplicar el arancel universitario:\n\n` +
      `🎓 *1. Estudiante de Pregrado UTA ($40,00 USD)*\n` +
      `_Requiere Certificado de Matrícula UTA o Carnet vigente._\n\n` +
      `🏛️ *2. Docente / Graduado / Empleado UTA ($50,00 USD)*\n` +
      `_Requiere Carnet Docente, Acción de Personal o Título._\n\n` +
      `🌐 *3. Público General ($60,00 USD)*\n` +
      `_Sin requisito académico adicional. Validación directa de pago._`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🎓 Estudiante UTA ($40,00)', callback_data: 'mat_cat_STUDENT_UTA' }],
        [{ text: '🏛️ Docente / Graduado ($50,00)', callback_data: 'mat_cat_TEACHER_UTA' }],
        [{ text: '🌐 Público General ($60,00)', callback_data: 'mat_cat_GENERAL_PUBLIC' }],
        [{ text: '⬅️ Cambiar Curso', callback_data: 'iniciar_matricula' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, text, keyboard);
  }

  private async askPersonalDataStep(
    chatId: string,
    category: ParticipantCategory,
  ): Promise<void> {
    const session = this.enrollmentSessions.get(chatId);
    if (!session) {
      await this.startEnrollmentFlow(chatId);
      return;
    }

    session.category = category;
    session.amount = category === 'STUDENT_UTA' ? 40 : category === 'TEACHER_UTA' ? 50 : 60;
    session.step = 'AWAIT_DATA';
    this.enrollmentSessions.set(chatId, session);

    const catName =
      category === 'STUDENT_UTA'
        ? 'Estudiante UTA ($40,00)'
        : category === 'TEACHER_UTA'
        ? 'Docente / Graduado UTA ($50,00)'
        : 'Público General ($60,00)';

    const text =
      `✅ *Categoría seleccionada:* ${catName}\n` +
      `💰 *Arancel a Cancelar:* *$${session.amount},00 USD*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📌 *Paso 3 de 4: Datos del Participante*\n` +
      `Por favor, escribe en un mensaje tu **Nombre Completo** y número de **Cédula de Identidad** (10 dígitos) para emitir tu certificado institucional.\n\n` +
      `✍️ *Ejemplo de formato:*\n` +
      `_Steeven Toala, 1804291823, steeven@uta.edu.ec_\n\n` +
      `_Envía el texto por este chat para continuar:_`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '❌ Cancelar Registro', callback_data: 'cancelar_matricula' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, text, keyboard);
  }

  private async handlePersonalDataInput(
    chatId: string,
    text: string,
    username: string,
    session: TelegramEnrollmentSession,
  ): Promise<void> {
    // 1. Extraer cédula de 10 dígitos numéricos continuos si está presente
    const idMatch = text.match(/\b\d{10}\b/);
    if (idMatch) {
      session.identification = idMatch[0];
    }

    // 2. Extraer email si está presente
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      session.email = emailMatch[0];
    }

    // 3. Extraer nombre eliminando cédula y email de la cadena
    let cleanName = text;
    if (session.identification) cleanName = cleanName.replace(session.identification, '');
    if (session.email) cleanName = cleanName.replace(session.email, '');
    cleanName = cleanName.replace(/[,;\n\-:]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Solo guardar el nombre si tiene al menos 3 letras y no es solo números
    if (cleanName.length >= 3 && !/^\d+$/.test(cleanName)) {
      session.buyerName = cleanName;
    }

    // =========================================================================
    // CONTROLES DE DATOS FALTANTES E INCOMPLETOS
    // =========================================================================

    // CONTROL A: Si falta la cédula de 10 dígitos
    if (!session.identification) {
      // Verificar si el usuario intentó escribir una cédula pero con longitud errónea (4 a 9 dígitos o >10)
      const partialDigits = text.match(/\b\d{4,9}\b|\b\d{11,}\b/);
      if (partialDigits) {
        await this.sendTelegramMessage(
          chatId,
          `⚠️ *Cédula no válida (${partialDigits[0].length} dígitos):*\n` +
            `Detectamos el valor \`${partialDigits[0]}\`. Recuerda que la cédula de identidad ecuatoriana debe tener exactamente **10 dígitos** numéricos (ej: \`1804291823\`).\n\n` +
            `✍️ *Por favor escribe tu cédula completa de 10 dígitos:*`,
        );
        return;
      }

      if (session.buyerName) {
        await this.sendTelegramMessage(
          chatId,
          `👤 *Nombre registrado:* *${session.buyerName}*\n\n` +
            `⚠️ *Falta tu número de Cédula de Identidad:*\n` +
            `Para emitir tu Certificado Universitario oficial avalado por la Universidad Técnica de Ambato (UTA), es obligatorio registrar tu cédula de **10 dígitos**.\n\n` +
            `✍️ *Por favor escribe tu cédula a continuación (ej: \`1804291823\`):*`,
        );
        return;
      }

      // Si no hay ni nombre ni cédula reconocibles
      await this.sendTelegramMessage(
        chatId,
        `⚠️ *Datos incompletos para tu matrícula en ${session.courseName}:*\n\n` +
          `Para registrar tu cupo necesitamos tu **Nombre Completo** y número de **Cédula de Identidad** (10 dígitos).\n\n` +
          `✍️ *Por favor escríbelos en este formato:*\n` +
          `_Steeven Alexander Toala, 1804291823_`,
      );
      return;
    }

    // CONTROL B: Si tiene cédula pero falta el nombre completo
    if (!session.buyerName || session.buyerName.length < 3) {
      await this.sendTelegramMessage(
        chatId,
        `🆔 *Cédula registrada:* \`${session.identification}\`\n\n` +
          `⚠️ *Falta tu Nombre Completo:*\n` +
          `Por favor escribe tus **Nombres y Apellidos** tal como deben constar en tu Certificado Oficial de la Universidad Técnica de Ambato (ej: *Steeven Alexander Toala*):`,
      );
      return;
    }

    // CONTROL C: Si no especificó email, generamos el correo institucional por defecto
    if (!session.email) {
      session.email = `${session.identification}@estudiantes.uta.edu.ec`;
    }

    // Ambos datos completos: avanzar a solicitud de comprobante
    session.step = 'AWAIT_PAYMENT_PROOF';
    this.enrollmentSessions.set(chatId, session);

    const askProofText =
      `👤 *Participante:* *${session.buyerName}*\n` +
      `🆔 *Cédula:* \`${session.identification}\`\n` +
      `📖 *Programa:* *${session.courseName}*\n` +
      `💰 *Monto a Cancelar:* *$${session.amount},00 USD*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📌 *Paso 4 de 4: Comprobante de Depósito / Transferencia*\n` +
      `Por favor realiza la transferencia a la cuenta autorizada de la universidad:\n\n` +
      `🏦 *Banco:* Banco del Pacífico / Pichincha\n` +
      `📋 *Cta. Corriente CTT-FISEI:* \`2100182741\`\n` +
      `🏛️ *Titular:* Universidad Técnica de Ambato (RUC: \`1860001560001\`)\n` +
      `💵 *Valor exacto:* *$${session.amount},00 USD*\n\n` +
      `📸 *Ahora, por favor ENVÍA UNA FOTO O CAPTURA DE PANTALLA DE TU COMPROBANTE DE PAGO aquí en este chat.*`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '💳 Ver Cuentas Bancarias', callback_data: 'datos_pago_matricula' }],
        [{ text: '✏️ Corregir Mis Datos', callback_data: 'corregir_datos_matricula' }],
        [{ text: '❌ Cancelar Matrícula', callback_data: 'cancelar_matricula' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, askProofText, keyboard);
  }

  private async finishEnrollment(chatId: string, session: TelegramEnrollmentSession): Promise<void> {
    const leads = await this.chatService.getAllLeads();
    const lead = leads.find((l) => l.chatId === chatId);

    const enrollment = await this.enrollmentsService.createEnrollment({
      leadId: lead?.id,
      buyerName: session.buyerName || 'Participante Telegram',
      identification: session.identification || '1800000000',
      email: session.email || null,
      phone: chatId,
      courseId: session.courseId || 'gh-600',
      category: session.category || 'STUDENT_UTA',
      paymentProofUrl: session.paymentProofUrl || null,
      academicCertUrl: session.academicCertUrl || null,
      notes: `Matrícula autogestionada directamente por el comprador en Telegram. Documentos listos para comprobación manual de secretaría.`,
    });

    this.enrollmentSessions.delete(chatId);

    const catLabel =
      session.category === 'STUDENT_UTA'
        ? 'Estudiante UTA ($40,00)'
        : session.category === 'TEACHER_UTA'
        ? 'Docente / Graduado ($50,00)'
        : 'Público General ($60,00)';

    const confirmText =
      `🎉 *¡SOLICITUD DE MATRÍCULA REGISTRADA CON ÉXITO!* 🎉\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Estimado/a *${session.buyerName}*, tus documentos han sido ingresados al sistema CTT-FISEI:\n\n` +
      `• *Programa:* ${enrollment.courseName}\n` +
      `• *Arancel Aplicado:* ${catLabel}\n` +
      `• *Valor Declarado:* $${enrollment.amount}.00 USD\n` +
      `• *Cédula:* \`${session.identification}\`\n` +
      `• *Folio Temporal:* \`SOL-${enrollment.id.slice(0, 8).toUpperCase()}\`\n\n` +
      `⚖️ *ESTADO: EN COLA DE AUDITORÍA MANUAL*\n` +
      `La Secretaría Académica de la FISEI revisará tu comprobante de pago y acreditación institucional.\n\n` +
      `En cuanto verifiquen tus documentos, recibirás tu confirmación de matrícula aprobada y credenciales de acceso directamente en este chat.\n\n` +
      `¡Mucho éxito en tu formación con la Universidad Técnica de Ambato!`;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🔄 Volver al Menú Principal', callback_data: 'volver_menu' }],
      ],
    };

    await this.sendTelegramMessageWithMarkup(chatId, confirmText, keyboard);
  }

  async sendTelegramMessage(chatId: string, message: string): Promise<void> {
    try {
      await axios.post(`${this.telegramApiUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
      });
    } catch (error: any) {
      this.logger.error(`Error enviando mensaje a Telegram (${chatId}): ${error.message}`);
    }
  }

  async sendTelegramMessageWithMarkup(chatId: string, message: string, replyMarkup: any): Promise<void> {
    try {
      await axios.post(`${this.telegramApiUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        reply_markup: replyMarkup,
      });
    } catch (error: any) {
      // Fallback a texto simple si Telegram rechaza markup
      await this.sendTelegramMessage(chatId, message);
    }
  }
}

