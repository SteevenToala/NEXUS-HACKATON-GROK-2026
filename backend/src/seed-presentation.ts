import { PrismaClient, SentimentState, MessageSender, ParticipantCategory, EnrollmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

// SVG decorativo de comprobante bancario para demo visual en la interfaz
const RECEIPT_IMAGE_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
  <rect width="600" height="380" rx="16" fill="#0f172a"/>
  <rect x="20" y="20" width="560" height="340" rx="12" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
  <text x="50" y="60" fill="#38bdf8" font-family="Arial, sans-serif" font-size="20" font-weight="bold">BANCO PICHINCHA - COMPROBANTE OFICIAL</text>
  <text x="50" y="90" fill="#94a3b8" font-family="Arial, sans-serif" font-size="12">Transferencia Interbancaria Directa • UTA CTT-FISEI</text>
  <line x1="50" y1="105" x2="550" y2="105" stroke="#334155" stroke-width="1.5"/>
  <text x="50" y="140" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Beneficiario:</text>
  <text x="220" y="140" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold">CTT FISEI UNIVERSIDAD TECNICA DE AMBATO</text>
  <text x="50" y="175" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">RUC Institucional:</text>
  <text x="220" y="175" fill="#ffffff" font-family="Arial, sans-serif" font-size="14">1860001560001</text>
  <text x="50" y="210" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Programa Académico:</text>
  <text x="220" y="210" fill="#38bdf8" font-family="Arial, sans-serif" font-size="14" font-weight="bold">GitHub Agentic AI (GH-600)</text>
  <text x="50" y="245" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Tarifa Aplicada:</text>
  <text x="220" y="245" fill="#34d399" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Estudiante UTA (Convalidación 32h)</text>
  <text x="50" y="280" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Monto Transferido:</text>
  <text x="220" y="285" fill="#10b981" font-family="Arial, sans-serif" font-size="22" font-weight="bold">$40.00 USD</text>
  <rect x="50" y="310" width="500" height="32" rx="6" fill="#047857"/>
  <text x="180" y="331" fill="#ecfdf5" font-family="Arial, sans-serif" font-size="13" font-weight="bold">✓ PAGO VALIDADO ELECTRÓNICAMENTE - ID #984321</text>
</svg>
`);

const RECEIPT_ARDUINO_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
  <rect width="600" height="380" rx="16" fill="#0f172a"/>
  <rect x="20" y="20" width="560" height="340" rx="12" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
  <text x="50" y="60" fill="#f59e0b" font-family="Arial, sans-serif" font-size="20" font-weight="bold">BANCO DEL PACÍFICO - COMPROBANTE DE DEPÓSITO</text>
  <text x="50" y="90" fill="#94a3b8" font-family="Arial, sans-serif" font-size="12">Depósito Ventanilla • Centro de Transferencia Tecnológica FISEI</text>
  <line x1="50" y1="105" x2="550" y2="105" stroke="#334155" stroke-width="1.5"/>
  <text x="50" y="140" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Titular de Cuenta:</text>
  <text x="220" y="140" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold">UNIVERSIDAD TECNICA DE AMBATO</text>
  <text x="50" y="175" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Cédula Depositante:</text>
  <text x="220" y="175" fill="#ffffff" font-family="Arial, sans-serif" font-size="14">1804928172</text>
  <text x="50" y="210" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Curso Seleccionado:</text>
  <text x="220" y="210" fill="#f59e0b" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Certificación Arduino & Robótica IoT</text>
  <text x="50" y="245" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Categoría:</text>
  <text x="220" y="245" fill="#38bdf8" font-family="Arial, sans-serif" font-size="14" font-weight="bold">Estudiante FISEI - Lab Huachi</text>
  <text x="50" y="280" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="14">Monto Depositado:</text>
  <text x="220" y="285" fill="#10b981" font-family="Arial, sans-serif" font-size="22" font-weight="bold">$40.00 USD</text>
  <rect x="50" y="310" width="500" height="32" rx="6" fill="#1e3a8a"/>
  <text x="170" y="331" fill="#dbeafe" font-family="Arial, sans-serif" font-size="13" font-weight="bold">✓ MATRÍCULA RESERVADA - DEPÓSITO #712490</text>
</svg>
`);

// SVG de Certificado de Matrícula UTA para verificación manual de estudiantes ($40)
const MATRICULA_CERT_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" rx="16" fill="#0f172a"/>
  <rect x="20" y="20" width="560" height="360" rx="12" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
  <text x="50" y="60" fill="#10b981" font-family="Arial, sans-serif" font-size="18" font-weight="bold">UNIVERSIDAD TÉCNICA DE AMBATO • FISEI</text>
  <text x="50" y="85" fill="#94a3b8" font-family="Arial, sans-serif" font-size="12">Dirección de Gestión Académica - Certificado Oficial de Matrícula</text>
  <line x1="50" y1="100" x2="550" y2="100" stroke="#334155" stroke-width="1.5"/>
  <text x="50" y="135" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Facultad:</text>
  <text x="210" y="135" fill="#ffffff" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Ingeniería en Sistemas, Electrónica e Industrial</text>
  <text x="50" y="170" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Carrera:</text>
  <text x="210" y="170" fill="#38bdf8" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Ingeniería de Software / Sistemas Computacionales</text>
  <text x="50" y="205" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Periodo Académico:</text>
  <text x="210" y="205" fill="#ffffff" font-family="Arial, sans-serif" font-size="13">Semestre Ordinario 2026-B</text>
  <text x="50" y="240" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Condición Estudiantil:</text>
  <text x="210" y="240" fill="#10b981" font-family="Arial, sans-serif" font-size="13" font-weight="bold">ESTUDIANTE REGULAR ACTIVO (ARANCEL $40.00)</text>
  <rect x="50" y="275" width="500" height="36" rx="6" fill="#064e3b" stroke="#059669" stroke-width="1"/>
  <text x="130" y="298" fill="#a7f3d0" font-family="Arial, sans-serif" font-size="12" font-weight="bold">✓ ACREDITACIÓN UNIVERSITARIA UTA VERIFICADA - QR VÁLIDO</text>
  <text x="50" y="345" fill="#64748b" font-family="Arial, sans-serif" font-size="10">Emitido por el Sistema Integrado de Gestión Académica UTA - Campus Huachi.</text>
</svg>
`);

// SVG de Credencial / Carnet Docente UTA para verificación manual de docentes ($50)
const DOCENTE_CERT_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
  <rect width="600" height="380" rx="16" fill="#0f172a"/>
  <rect x="20" y="20" width="560" height="340" rx="12" fill="#1e293b" stroke="#818cf8" stroke-width="2"/>
  <text x="50" y="60" fill="#818cf8" font-family="Arial, sans-serif" font-size="18" font-weight="bold">UNIVERSIDAD TÉCNICA DE AMBATO • FISEI</text>
  <text x="50" y="85" fill="#94a3b8" font-family="Arial, sans-serif" font-size="12">Credencial Institucional / Acción de Personal - Personal Docente & Alumni</text>
  <line x1="50" y1="100" x2="550" y2="100" stroke="#334155" stroke-width="1.5"/>
  <text x="50" y="140" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Rol Institucional:</text>
  <text x="210" y="140" fill="#ffffff" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Docente Titular / Graduado FISEI</text>
  <text x="50" y="175" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Departamento:</text>
  <text x="210" y="175" fill="#38bdf8" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Redes, Telecomunicaciones y Software</text>
  <text x="50" y="210" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="13">Arancel Aplicable:</text>
  <text x="210" y="210" fill="#a5b4fc" font-family="Arial, sans-serif" font-size="13" font-weight="bold">Docente / Graduado FISEI ($50.00 USD)</text>
  <rect x="50" y="250" width="500" height="36" rx="6" fill="#312e81" stroke="#4f46e5" stroke-width="1"/>
  <text x="140" y="273" fill="#e0e7ff" font-family="Arial, sans-serif" font-size="12" font-weight="bold">✓ ACREDITACIÓN DOCENTE APROBADA - CÓDIGO #DOC-UTA-2026</text>
  <text x="50" y="325" fill="#64748b" font-family="Arial, sans-serif" font-size="10">Aval institucional emitido por Decanato y Secretaría Académica FISEI.</text>
</svg>
`);

interface ExampleLead {
  chatId: string;
  name: string;
  sentimentState: SentimentState;
  isHumanIntervening: boolean;
  minutesAgo: number;
  messages: {
    sender: MessageSender;
    text: string;
    mediaUrl?: string;
    mediaType?: string;
    offsetMinutes: number;
  }[];
}

const DEMO_LEADS: ExampleLead[] = [
  // ==========================================
  // GRUPO 1: CALIENTE (HOT - ALTA INTENCIÓN DE PAGO)
  // ==========================================
  {
    chatId: 'demo-mateo-silva',
    name: 'Mateo Silva (Software FISEI)',
    sentimentState: SentimentState.HOT,
    isHumanIntervening: false,
    minutesAgo: 8,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenas tardes, soy Mateo Silva de 7mo semestre de la carrera de Software. ¿El curso de GitHub Agentic AI (GH-600) convalida horas de prácticas o vinculación?',
        offsetMinutes: 20,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Mateo! Qué gusto saludarte. Sí, el curso de Preparación GitHub Certified: Agentic AI Developer (GH-600) está avalado institucionalmente por la FISEI-UTA y convalida 32 horas académicas oficiales con resolución de Consejo Directivo.\n\n• Modalidad: Virtual sincrónico (Zoom)\n• Horarios: Sábados de 08:00 a 14:00 (Inicia 14 de Noviembre)\n• Inversión Estudiante UTA: $40,00 (Certificado digital oficial con código QR verificable)\n\n¿Te gustaría que te facilite el enlace de inscripción directa para separar tu cupo?',
        offsetMinutes: 18,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Excelente, justo eso necesitaba para completar mis horas. Pásame la cuenta o el enlace del portal para pagar hoy mismo los $40 por favor.',
        offsetMinutes: 15,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Perfecto, Mateo! Tu cupo está pre-reservado. Puedes formalizar tu matrícula en el portal oficial del CTT-FISEI:\n\n🔗 https://ctt-talleresfisei.uta.edu.ec/curso19.php\n\nSolo ingresas con tu correo institucional UTA y adjuntas tu comprobante. ¡Bienvenido al ecosistema Agentic AI!',
        offsetMinutes: 8,
      },
    ],
  },
  {
    chatId: 'demo-gabriel-toapanta',
    name: 'Gabriel Toapanta (Comprobante Adjunto)',
    sentimentState: SentimentState.HOT,
    isHumanIntervening: false,
    minutesAgo: 4,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Hola, acabo de realizar la transferencia de $40 por el curso de GitHub Agentic AI para estudiantes UTA.',
        offsetMinutes: 10,
      },
      {
        sender: MessageSender.LEAD,
        text: '📷 [Imagen]: Adjunto mi comprobante de depósito del Banco Pichincha Ref #984321.',
        mediaUrl: RECEIPT_IMAGE_SVG,
        mediaType: 'image',
        offsetMinutes: 7,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Excelente Gabriel! Hemos verificado tu comprobante de $40,00 para GitHub Agentic AI (GH-600). En unos minutos tesorería emitirá tu confirmación de matrícula con credenciales del aula virtual Zoom. ¡Mucho éxito en tu formación!',
        offsetMinutes: 4,
      },
    ],
  },
  {
    chatId: 'demo-daniela-salazar',
    name: 'Daniela Salazar (Sistemas FISEI)',
    sentimentState: SentimentState.HOT,
    isHumanIntervening: false,
    minutesAgo: 15,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Hola buenas tardes! Ya hice el pago de $40 para el curso de Arduino en ventanilla, ¿dónde subo el comprobante?',
        offsetMinutes: 22,
      },
      {
        sender: MessageSender.LEAD,
        text: '📷 [Imagen]: Foto del comprobante de ventanilla Banco del Pacífico #712490.',
        mediaUrl: RECEIPT_ARDUINO_SVG,
        mediaType: 'image',
        offsetMinutes: 18,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Daniela! Recibido con éxito. Tu comprobante físico de $40,00 para Certificación Arduino & Robótica IoT ha sido ingresado al sistema. Te esperamos el sábado 14 de noviembre en el Lab de Huachi.',
        offsetMinutes: 15,
      },
    ],
  },
  {
    chatId: 'demo-andrea-morales',
    name: 'Ing. Andrea Morales (Docente UTA)',
    sentimentState: SentimentState.HOT,
    isHumanIntervening: false,
    minutesAgo: 25,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Saludos cordiales. Soy Andrea Morales, docente del área de Redes en FISEI. Queremos inscribir a 3 ayudantes de cátedra en el curso de Python 2 (Cisco NetAcad). ¿Cuál es la tarifa institucional?',
        offsetMinutes: 35,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Estimada Ing. Andrea! Un gran saludo de parte del CTT-FISEI. Para personal docente y ayudantes acreditados aplica la tarifa institucional de $50,00 por participante.\n\n• Programa: Fundamentos de Python 2 (Cisco NetAcad)\n• Horas: 40 horas con examen oficial de certificación Cisco incluido\n• Certificación: Doble aval CTT-FISEI y Credencial Digital Cisco\n\n¿Desea que emitamos la proforma institucional o los inscribe individualmente en el portal?',
        offsetMinutes: 30,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Requerimos factura a nombre de la Universidad Técnica de Ambato. Indíqueme por favor a qué correo enviamos el requerimiento para transferir hoy.',
        offsetMinutes: 28,
      },
      {
        sender: MessageSender.BOT,
        text: 'Con todo gusto, Ingeniera. Para facturación con RUC UTA, puede remitir el listado de cédulas a ctt.fisei@uta.edu.ec. Los 3 cupos quedan pre-asignados a su nombre.',
        offsetMinutes: 25,
      },
    ],
  },
  {
    chatId: 'demo-bryan-guaman',
    name: 'Bryan Guamán (Automatización)',
    sentimentState: SentimentState.HOT,
    isHumanIntervening: false,
    minutesAgo: 32,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Hola! Quiero pagar los $40 de Arduino ya mismo, me dan los datos de la cuenta porfa?',
        offsetMinutes: 40,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Bryan! Claro que sí:\n• Cuenta Corriente Banco del Pacífico #01234567\n• A nombre de: Universidad Técnica de Ambato\n• RUC: 1860001560001\n• Valor: $40,00 (Estudiantes UTA)\nUna vez transferido, sube la foto en https://ctt-talleresfisei.uta.edu.ec/curso20.php o por este chat.',
        offsetMinutes: 36,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Listo, en 10 minutos transfiero desde mi banca web de Pichincha.',
        offsetMinutes: 32,
      },
    ],
  },
  {
    chatId: 'demo-roberto-cifuentes',
    name: 'Ing. Roberto Cifuentes (Decanato)',
    sentimentState: SentimentState.HOT,
    isHumanIntervening: false,
    minutesAgo: 45,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Estimados, desde decanato queremos becar a 5 estudiantes destacados en GitHub Agentic AI. ¿Podemos hacer pago consolidado?',
        offsetMinutes: 55,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Estimado Ing. Roberto! Por supuesto, podemos procesar el registro institucional por lote con memorando interno y emitir el acta para los 5 becarios.',
        offsetMinutes: 50,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Perfecto, hoy envío el memorando de aprobación presupuestaria.',
        offsetMinutes: 45,
      },
    ],
  },

  // ==========================================
  // GRUPO 2: ESCALADO (FRUSTRATED / RECONOCIDO POR IA)
  // ==========================================
  {
    chatId: 'demo-carmen-villacis',
    name: 'Dra. Carmen Villacís',
    sentimentState: SentimentState.FRUSTRATED,
    isHumanIntervening: true,
    minutesAgo: 10,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenos días. Llevo más de 20 minutos intentando subir la transferencia para el curso de Arduino en la página del CTT y el sistema me bota error de servidor.',
        offsetMinutes: 16,
      },
      {
        sender: MessageSender.BOT,
        text: 'Lamento mucho los inconvenientes, Dra. Villacís. Nuestro portal está experimentando una alta concurrencia de inscripciones. Para evitar que pierdas tu cupo, en este momento estoy escalando tu caso de forma prioritaria con nuestro equipo de soporte humano del CTT-FISEI.',
        offsetMinutes: 14,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Por favor me urge porque se cierran los cupos presenciales en Lab Huachi y no quiero quedarme fuera.',
        offsetMinutes: 12,
      },
      {
        sender: MessageSender.HUMAN_AGENT,
        text: 'Estimada Dra. Carmen, un cordial saludo. Le saluda el operador de soporte del CTT-FISEI. Ya tengo reservado su cupo manualmente en el laboratorio. Puede enviarnos el comprobante por este mismo chat y nosotros validamos su matrícula de inmediato.',
        offsetMinutes: 10,
      },
    ],
  },
  {
    chatId: 'demo-patricio-gavilanez',
    name: 'Ing. Patricio Gavilánez (Soporte Transferencia)',
    sentimentState: SentimentState.FRUSTRATED,
    isHumanIntervening: true,
    minutesAgo: 18,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenas tardes, hice una transferencia hace 3 días y nadie me responde al correo ni me llega la confirmación del curso.',
        offsetMinutes: 28,
      },
      {
        sender: MessageSender.BOT,
        text: 'Comprendo perfectamente su preocupación, Ing. Patricio. Permítame transferirlo de inmediato con el encargado de tesorería del CTT-FISEI para rastrear su depósito con el número de transacción.',
        offsetMinutes: 24,
      },
      {
        sender: MessageSender.HUMAN_AGENT,
        text: 'Estimado Patricio, disculpe la demora. Ya ubiqué su transacción en el extracto de Banco del Pacífico. Su matrícula en Python 2 Cisco NetAcad está 100% activa. Le acabo de reenviar el correo de bienvenida.',
        offsetMinutes: 18,
      },
    ],
  },
  {
    chatId: 'demo-maria-jose-ramos',
    name: 'María José Ramos (Problema Zoom)',
    sentimentState: SentimentState.FRUSTRATED,
    isHumanIntervening: false,
    minutesAgo: 50,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Hola, intento entrar al enlace de prueba de Zoom del taller y dice contraseña incorrecta, qué hago?',
        offsetMinutes: 58,
      },
      {
        sender: MessageSender.BOT,
        text: 'Hola María José, no te preocupes. La contraseña del enlace sincrónico se activa 30 minutos antes de la sesión. Además, el enlace con token directo está disponible en tu panel del campus virtual: https://ctt-talleresfisei.uta.edu.ec',
        offsetMinutes: 52,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Ah perfecto, ya logré ingresar desde el panel. Muchas gracias.',
        offsetMinutes: 50,
      },
    ],
  },

  // ==========================================
  // GRUPO 3: INTERESADO (INTERESTED - EVALUANDO PÉNSUM)
  // ==========================================
  {
    chatId: 'demo-sebastian-zurita',
    name: 'Sebastián Zurita (Robótica IoT)',
    sentimentState: SentimentState.INTERESTED,
    isHumanIntervening: false,
    minutesAgo: 40,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Hola! Una consulta sobre la Certificación Arduino & Robótica, ¿los componentes electrónicos y placas se entregan en el laboratorio o debemos comprarlos?',
        offsetMinutes: 60,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Sebastián! Excelente pregunta. Las 40 horas prácticas se imparten directamente en el Laboratorio de Sistemas Embebidos del Campus Huachi.\n\n• Equipamiento: El laboratorio provee los bancos de prueba, osciloscopios, sensores IoT y kits Arduino durante las sesiones.\n• Inversión: $40 estudiantes UTA ($50 graduados | $60 público general)\n• Horario: Sábados intensivos de 08:30 a 14:30\n\nAl finalizar recibirás tu certificado con código QR oficial.',
        offsetMinutes: 52,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Genial que presten los kits! ¿Cuándo inician las clases prácticas en Huachi?',
        offsetMinutes: 48,
      },
      {
        sender: MessageSender.BOT,
        text: 'Iniciamos el sábado 14 de noviembre. Los cupos en laboratorio son limitados a 25 estaciones por capacidad física. Puedes reservar el tuyo en: https://ctt-talleresfisei.uta.edu.ec/curso20.php',
        offsetMinutes: 40,
      },
    ],
  },
  {
    chatId: 'demo-valeria-cardenas',
    name: 'Valeria Cárdenas (Graduada UTA)',
    sentimentState: SentimentState.INTERESTED,
    isHumanIntervening: false,
    minutesAgo: 60,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenas noches, soy graduada de Ingeniería Industrial de la UTA. ¿El curso de GitHub Agentic AI requiere conocimientos previos de programación avanzada?',
        offsetMinutes: 85,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Valeria! Qué gusto saludarte como alumni FISEI. El programa GH-600 arranca desde los fundamentos de agentes inteligentes y prompt engineering guiado, hasta la automatización con GitHub Copilot Workspace. No necesitas ser programadora avanzada, solo lógica básica.\n\nComo graduada aplicas a la tarifa preferencial de $50,00.',
        offsetMinutes: 78,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Me interesa mucho para automatizar procesos en mi empresa. ¿Las clases de los sábados quedan grabadas?',
        offsetMinutes: 74,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Sí! Todas las sesiones sincrónicas por Zoom se graban en alta definición y quedan disponibles 24/7 en el campus virtual para que repases cuando gustes.',
        offsetMinutes: 60,
      },
    ],
  },
  {
    chatId: 'demo-lorena-morales',
    name: 'Lorena Morales (Software 4to)',
    sentimentState: SentimentState.INTERESTED,
    isHumanIntervening: false,
    minutesAgo: 70,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Hola, ¿en el curso de Agentic AI se enseña a conectar modelos open-source como Ollama o DeepSeek?',
        offsetMinutes: 80,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Lorena! Sí, el módulo práctico abarca integración de agentes autónomos tanto con APIs cloud (OpenAI, Gemini) como con inferencia local usando Ollama para arquitecturas privadas.',
        offsetMinutes: 75,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Buenísimo! Voy a coordinar con un compañero de semestre para inscribirnos los dos.',
        offsetMinutes: 70,
      },
    ],
  },
  {
    chatId: 'demo-santiago-freire',
    name: 'Santiago Freire (Electrónica)',
    sentimentState: SentimentState.INTERESTED,
    isHumanIntervening: false,
    minutesAgo: 85,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenas tardes, ¿en Arduino se programa en C++ puro o en MicroPython?',
        offsetMinutes: 95,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Santiago! Se trabaja principalmente en C++ sobre Arduino IDE 2.0 y PlatformIO, con introducción a MicroPython en módulos ESP32.',
        offsetMinutes: 90,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Me gusta ese enfoque. Voy a revisar las fechas de exámenes finales para asegurar mi horario.',
        offsetMinutes: 85,
      },
    ],
  },
  {
    chatId: 'demo-edison-chango',
    name: 'Edison Chango (Consulta de Audio)',
    sentimentState: SentimentState.INTERESTED,
    isHumanIntervening: false,
    minutesAgo: 95,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: '🎙️ [Nota de voz]: Hola buenos días, quería consultar si el curso de Python 2 tiene flexibilidad de horario ya que trabajo por las mañanas...',
        offsetMinutes: 105,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Edison! Escuchamos tu nota de voz. El curso de Fundamentos de Python 2 (Cisco NetAcad) es en modalidad virtual flexible: puedes ingresar al material interactivo y laboratorios en el horario que mejor te convenga, 24/7.\n\nLa inversión es de $40 para estudiantes UTA ($50 graduados / $60 público general). ¿En qué área trabajas actualmente?',
        offsetMinutes: 95,
      },
    ],
  },
  {
    chatId: 'demo-david-guanochanga',
    name: 'David Guanochanga (Mecatrónica)',
    sentimentState: SentimentState.INTERESTED,
    isHumanIntervening: false,
    minutesAgo: 110,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenas tardes, ¿en el curso de Arduino vemos comunicación inalámbrica con ESP32 o Bluetooth?',
        offsetMinutes: 125,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola David! Sí, el módulo 3 del curso presencial de Arduino & Robótica cubre integración con módulos inalámbricos (Bluetooth HC-05 y ESP32 WiFi) para proyectos IoT y telemetría en tiempo real.\n\n¿Estás pensando aplicarlo en tu proyecto de titulación o materias de carrera?',
        offsetMinutes: 118,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Sí, para un prototipo de automatización agrícola. Me parece perfecto el temario.',
        offsetMinutes: 110,
      },
    ],
  },

  // ==========================================
  // GRUPO 4: CONSULTA INICIAL (NEUTRAL)
  // ==========================================
  {
    chatId: 'demo-kevin-paredes',
    name: 'Kevin Paredes (Telecomunicaciones)',
    sentimentState: SentimentState.NEUTRAL,
    isHumanIntervening: false,
    minutesAgo: 130,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenas tardes, ¿tienen algún curso de redes de Cisco o solo Python?',
        offsetMinutes: 140,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Kevin! Actualmente en convenio con Cisco Networking Academy tenemos disponible el programa oficial de Fundamentos de Python 2 (Cisco NetAcad), enfocado en automatización de redes y scripts.\n\nSi buscas Cisco CCNA, la siguiente cohorte se abrirá a inicios de 2027. ¿Te gustaría conocer el temario de Python 2 mientras tanto?',
        offsetMinutes: 135,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Revisaré el de Python por ahora, gracias.',
        offsetMinutes: 130,
      },
    ],
  },
  {
    chatId: 'demo-camila-viteri',
    name: 'Camila Viteri (Público General)',
    sentimentState: SentimentState.NEUTRAL,
    isHumanIntervening: false,
    minutesAgo: 150,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Hola, disculpen, ¿personas que no estudian en la UTA se pueden matricular?',
        offsetMinutes: 165,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Camila! Por supuesto, los programas del CTT-FISEI están completamente abiertos al público general y profesionales externos.\n\nLa inversión para público general es de $60,00 con certificación institucional y código QR de aprobación. Tenemos cupos en: 1. GitHub Agentic AI, 2. Certificación Arduino, y 3. Python 2 Cisco NetAcad.',
        offsetMinutes: 158,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Genial, ¿se puede pagar con tarjeta de crédito desde la web?',
        offsetMinutes: 154,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Sí! Puedes pagar con tarjeta de crédito, débito o transferencia desde el portal oficial: https://ctt-talleresfisei.uta.edu.ec/course.php',
        offsetMinutes: 150,
      },
    ],
  },
  {
    chatId: 'demo-joel-alarcon',
    name: 'Joel Alarcón',
    sentimentState: SentimentState.NEUTRAL,
    isHumanIntervening: false,
    minutesAgo: 180,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenas, ¿los cursos tienen clases los domingos?',
        offsetMinutes: 190,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Joel! Las clases sincrónicas y presenciales se imparten únicamente los sábados. En el caso de Python 2 Cisco NetAcad, el aula virtual está disponible 24/7 para que avances cualquier día.',
        offsetMinutes: 185,
      },
      {
        sender: MessageSender.LEAD,
        text: 'Entendido, gracias por el dato.',
        offsetMinutes: 180,
      },
    ],
  },
  {
    chatId: 'demo-veronica-tello',
    name: 'Verónica Tello (Quito)',
    sentimentState: SentimentState.NEUTRAL,
    isHumanIntervening: false,
    minutesAgo: 210,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Buenas tardes, ¿me pueden facilitar el catálogo de cursos en formato digital?',
        offsetMinutes: 220,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Hola Verónica! Claro que sí, puedes explorar el catálogo oficial completo con sílabos detallados en: https://ctt-talleresfisei.uta.edu.ec/course.php',
        offsetMinutes: 210,
      },
    ],
  },

  // ==========================================
  // GRUPO 5: EN ATENCIÓN MANUAL (HANDOVER ACTIVO)
  // ==========================================
  {
    chatId: 'demo-fernando-morales',
    name: 'Lic. Fernando Morales (Convenio Tech)',
    sentimentState: SentimentState.HOT,
    isHumanIntervening: true,
    minutesAgo: 20,
    messages: [
      {
        sender: MessageSender.LEAD,
        text: 'Estimados CTT-FISEI, represento a una software factory en Ambato y queremos capacitar a 10 ingenieros en GitHub Agentic AI. ¿Manejan descuento corporativo?',
        offsetMinutes: 50,
      },
      {
        sender: MessageSender.BOT,
        text: '¡Bienvenido, Lic. Fernando! Qué excelente iniciativa para la industria regional. Para grupos empresariales de más de 8 ingenieros contamos con condiciones corporativas especiales.\n\nEn este momento notifico a la Dirección del CTT para coordinar su propuesta personalizada.',
        offsetMinutes: 44,
      },
      {
        sender: MessageSender.HUMAN_AGENT,
        text: 'Estimado Fernando, le saluda la coordinación del CTT-FISEI. Le ofrecemos un descuento corporativo del 20% para su equipo ($48/participante) con certificación oficial UTA y seguimiento gerencial. Le envié los detalles al correo institucional.',
        offsetMinutes: 20,
      },
    ],
  },
];

async function seed() {
  console.log('🚀 Iniciando siembra masiva de chats y leads de demostración para el pitch...');

  const now = Date.now();

  for (const leadData of DEMO_LEADS) {
    const leadUpdatedAt = new Date(now - leadData.minutesAgo * 60 * 1000);
    const leadCreatedAt = new Date(now - (leadData.minutesAgo + 50) * 60 * 1000);

    // Upsert Lead
    const lead = await prisma.lead.upsert({
      where: { chatId: leadData.chatId },
      update: {
        name: leadData.name,
        sentimentState: leadData.sentimentState,
        isHumanIntervening: leadData.isHumanIntervening,
        updatedAt: leadUpdatedAt,
      },
      create: {
        chatId: leadData.chatId,
        name: leadData.name,
        sentimentState: leadData.sentimentState,
        isHumanIntervening: leadData.isHumanIntervening,
        createdAt: leadCreatedAt,
        updatedAt: leadUpdatedAt,
      },
    });

    // Limpiar mensajes previos de este lead demo para que no se dupliquen al re-ejecutar
    await prisma.message.deleteMany({
      where: { leadId: lead.id },
    });

    // Insertar mensajes en orden cronológico
    for (const msg of leadData.messages) {
      const msgCreatedAt = new Date(now - msg.offsetMinutes * 60 * 1000);
      await prisma.message.create({
        data: {
          leadId: lead.id,
          sender: msg.sender,
          text: msg.text,
          mediaUrl: msg.mediaUrl || null,
          mediaType: msg.mediaType || null,
          createdAt: msgCreatedAt,
        },
      });
    }

    console.log(`✓ Lead [${lead.sentimentState}] (${lead.isHumanIntervening ? 'HANDOVER' : 'BOT'}): ${lead.name}`);
  }

  // =========================================================================
  // SIEMBRA DE REGISTRO DE COMPRADORES & MATRÍCULAS (VALIDACIÓN MANUAL)
  // =========================================================================
  console.log('📦 Sembrando registro de compradores y validación de matrículas...');

  await prisma.enrollment.deleteMany();

  const mateoLead = await prisma.lead.findUnique({ where: { chatId: 'demo-mateo-silva' } });
  const gabrielLead = await prisma.lead.findUnique({ where: { chatId: 'demo-gabriel-toapanta' } });
  const andreaLead = await prisma.lead.findUnique({ where: { chatId: 'demo-andrea-morales' } });
  const danielaLead = await prisma.lead.findUnique({ where: { chatId: 'demo-daniela-salazar' } });
  const sebastianLead = await prisma.lead.findUnique({ where: { chatId: 'demo-sebastian-zurita' } });
  const valeriaLead = await prisma.lead.findUnique({ where: { chatId: 'demo-valeria-cardenas' } });
  const camilaLead = await prisma.lead.findUnique({ where: { chatId: 'demo-camila-viteri' } });
  const edisonLead = await prisma.lead.findUnique({ where: { chatId: 'demo-edison-chango' } });

  const DEMO_ENROLLMENTS = [
    {
      leadId: mateoLead?.id,
      buyerName: 'Mateo Alexander Silva López',
      identification: '1804928172',
      email: 'mateo.silva@uta.edu.ec',
      phone: '+593 99 876 5432',
      courseId: 'gh-600',
      courseName: 'GitHub Agentic AI (GH-600)',
      category: ParticipantCategory.STUDENT_UTA,
      amount: 40.0,
      paymentProofUrl: RECEIPT_IMAGE_SVG,
      academicCertUrl: MATRICULA_CERT_SVG,
      status: EnrollmentStatus.PENDING_VERIFICATION,
      verifiedBy: null,
      notes: 'Estudiante 7mo Software. Comprobante de $40 listo para comprobación de secretaría.',
      createdAt: new Date(now - 12 * 60 * 1000),
    },
    {
      leadId: gabrielLead?.id,
      buyerName: 'Gabriel Antonio Toapanta Paredes',
      identification: '1803719481',
      email: 'gabriel.toapanta@uta.edu.ec',
      phone: '+593 98 412 8790',
      courseId: 'gh-600',
      courseName: 'GitHub Agentic AI (GH-600)',
      category: ParticipantCategory.STUDENT_UTA,
      amount: 40.0,
      paymentProofUrl: RECEIPT_IMAGE_SVG,
      academicCertUrl: MATRICULA_CERT_SVG,
      status: EnrollmentStatus.APPROVED,
      verifiedBy: 'Ing. Asesor CTT-FISEI',
      notes: 'Matrícula aprobada. Certificado de matrícula verificado con secretaría académica.',
      createdAt: new Date(now - 30 * 60 * 1000),
    },
    {
      leadId: andreaLead?.id,
      buyerName: 'Ing. Andrea Morales Sánchez',
      identification: '1802938475',
      email: 'andrea.morales@uta.edu.ec',
      phone: '+593 99 321 0987',
      courseId: 'python',
      courseName: 'Python 2 (Cisco NetAcad)',
      category: ParticipantCategory.TEACHER_UTA,
      amount: 50.0,
      paymentProofUrl: RECEIPT_IMAGE_SVG,
      academicCertUrl: DOCENTE_CERT_SVG,
      status: EnrollmentStatus.APPROVED,
      verifiedBy: 'Coordinación CTT-FISEI',
      notes: 'Docente FISEI. Arancel docente $50.00 convalidado con carnet docente UTA.',
      createdAt: new Date(now - 45 * 60 * 1000),
    },
    {
      leadId: danielaLead?.id,
      buyerName: 'Daniela Fernanda Salazar Castro',
      identification: '1805128394',
      email: 'daniela.salazar@uta.edu.ec',
      phone: '+593 98 654 3210',
      courseId: 'arduino',
      courseName: 'Certificación Arduino & Robótica',
      category: ParticipantCategory.STUDENT_UTA,
      amount: 40.0,
      paymentProofUrl: RECEIPT_ARDUINO_SVG,
      academicCertUrl: MATRICULA_CERT_SVG,
      status: EnrollmentStatus.PENDING_VERIFICATION,
      verifiedBy: null,
      notes: 'Depósito ventanilla Banco del Pacífico. Pendiente verificar carnet estudiantil.',
      createdAt: new Date(now - 20 * 60 * 1000),
    },
    {
      leadId: sebastianLead?.id,
      buyerName: 'Sebastián David Zurita Ramos',
      identification: '1804291830',
      email: 'sebastian.zurita@uta.edu.ec',
      phone: '+593 99 123 4567',
      courseId: 'arduino',
      courseName: 'Certificación Arduino & Robótica',
      category: ParticipantCategory.STUDENT_UTA,
      amount: 40.0,
      paymentProofUrl: RECEIPT_ARDUINO_SVG,
      academicCertUrl: MATRICULA_CERT_SVG,
      status: EnrollmentStatus.APPROVED,
      verifiedBy: 'Lab Huachi',
      notes: 'Estación asignada en laboratorio de robótica.',
      createdAt: new Date(now - 65 * 60 * 1000),
    },
    {
      leadId: valeriaLead?.id,
      buyerName: 'Ing. Valeria Cárdenas Ortiz',
      identification: '1801827364',
      email: 'valeria.cardenas@gmail.com',
      phone: '+593 98 789 0123',
      courseId: 'gh-600',
      courseName: 'GitHub Agentic AI (GH-600)',
      category: ParticipantCategory.TEACHER_UTA,
      amount: 50.0,
      paymentProofUrl: RECEIPT_IMAGE_SVG,
      academicCertUrl: DOCENTE_CERT_SVG,
      status: EnrollmentStatus.APPROVED,
      verifiedBy: 'Secretaría Académica',
      notes: 'Alumni FISEI. Título profesional validado en SENESCYT.',
      createdAt: new Date(now - 90 * 60 * 1000),
    },
    {
      leadId: camilaLead?.id,
      buyerName: 'Camila Sofía Viteri Mendoza',
      identification: '1720394851',
      email: 'camila.viteri@outlook.com',
      phone: '+593 99 888 7777',
      courseId: 'python',
      courseName: 'Python 2 (Cisco NetAcad)',
      category: ParticipantCategory.GENERAL_PUBLIC,
      amount: 60.0,
      paymentProofUrl: RECEIPT_IMAGE_SVG,
      academicCertUrl: null,
      status: EnrollmentStatus.APPROVED,
      verifiedBy: 'Tesorería CTT-FISEI',
      notes: 'Público General ($60). No requiere certificado académico. Transferencia validada.',
      createdAt: new Date(now - 120 * 60 * 1000),
    },
    {
      leadId: edisonLead?.id,
      buyerName: 'Edison Patricio Chango Morales',
      identification: '1803847291',
      email: 'edison.chango@uta.edu.ec',
      phone: '+593 98 333 2222',
      courseId: 'python',
      courseName: 'Python 2 (Cisco NetAcad)',
      category: ParticipantCategory.STUDENT_UTA,
      amount: 40.0,
      paymentProofUrl: RECEIPT_IMAGE_SVG,
      academicCertUrl: MATRICULA_CERT_SVG,
      status: EnrollmentStatus.REJECTED,
      verifiedBy: 'Secretaría CTT-FISEI',
      notes: 'Comprobante bancario borroso. Se solicitó al estudiante remitir nuevamente la captura.',
      createdAt: new Date(now - 140 * 60 * 1000),
    },
  ];

  for (const item of DEMO_ENROLLMENTS) {
    await prisma.enrollment.create({
      data: item,
    });
    console.log(`✓ Matrícula [${item.status}]: ${item.buyerName} - ${item.courseName} ($${item.amount})`);
  }

  const total = await prisma.lead.count();
  const totalEnrollments = await prisma.enrollment.count();
  console.log(`🎉 ¡Siembra masiva completada! Total leads: ${total} | Total compradores/matrículas: ${totalEnrollments}`);
}

seed()
  .catch((e) => {
    console.error('Error sembrando datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
