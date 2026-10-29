export interface CourseDetail {
  id: string;
  name: string;
  url: string;
  registrationUrl: string;
  instructors: string;
  modality: string;
  location: string;
  hours: number;
  dates: string;
  schedule: string;
  registrationDates: string;
  prices: {
    studentsUta: number;
    graduatesTeachersUta: number;
    generalPublic: number;
  };
  description: string;
  topics: string[];
}

export const CTT_FISEI_COURSES: CourseDetail[] = [
  {
    id: 'gh-600',
    name: 'Preparación GitHub Certified: Agentic AI Developer (GH-600)',
    url: 'https://ctt-talleresfisei.uta.edu.ec/curso19.php',
    registrationUrl: 'https://ctt-talleresfisei.uta.edu.ec/curso19.php#inscripcion',
    instructors: 'Ing. Javier Santiago Vargas Paredes, Mg.',
    modality: 'Virtual por Zoom',
    location: 'Virtual por Zoom - Centro de Transferencia CTT-FISEI',
    hours: 32,
    dates: 'Del 14 de noviembre al 05 de diciembre de 2026',
    schedule: 'Sábados (14, 21, 28 de nov y 5 de dic), de 08:00 a 14:00 (24h sincrónicas + 8h autónomas)',
    registrationDates: 'Del 30 de octubre al 13 de noviembre de 2026',
    prices: {
      studentsUta: 40.0,
      graduatesTeachersUta: 50.0,
      generalPublic: 60.0,
    },
    description: 'Capacitación en agentes de IA aplicados al ciclo de desarrollo de software (SDLC). Abarca Git, GitHub, GitHub Actions (CI/CD), GitHub Copilot, instrucciones para agentes y Model Context Protocol (MCP).',
    topics: [
      'Git y GitHub: repositorios, commits, ramas y pull requests colaborativos',
      'Introducción al SDLC, CI/CD y automatización con GitHub Actions',
      'Agentes de codificación y prompting para desarrollo con GitHub Copilot',
      'Model Context Protocol (MCP), herramientas, memoria y estado de agentes',
      'Criterios de éxito, guardrails y supervisión humana en proyectos integradores',
    ],
  },
  {
    id: 'arduino-prep',
    name: 'Preparación Arduino Certification Program',
    url: 'https://ctt-talleresfisei.uta.edu.ec/curso20.php',
    registrationUrl: 'https://ctt-talleresfisei.uta.edu.ec/curso20.php#inscripcion',
    instructors: 'Ing. Carlos Luis Vargas Guevara, Mg. y Ing. Jesús Israel Guamán Molina, Mg.',
    modality: 'Presencial',
    location: 'Talleres de Innovación y Desarrollo Tecnológico FISEI, Campus Huachi, Ambato',
    hours: 32,
    dates: 'Del 14 de noviembre al 05 de diciembre de 2026',
    schedule: 'Clases presenciales los sábados 14, 21 y 28 de noviembre y 5 de diciembre de 2026',
    registrationDates: 'Del 30 de octubre al 13 de noviembre de 2026',
    prices: {
      studentsUta: 40.0,
      graduatesTeachersUta: 50.0,
      generalPublic: 60.0,
    },
    description: 'Formación teórico-práctica en electricidad, circuitos DC, instrumentación, multímetro y programación de microcontroladores Arduino Uno en protoboard.',
    topics: [
      'Leyes fundamentales de circuitos eléctricos y mediciones con multímetro',
      'Programación estructurada en C/C++ utilizando Arduino IDE',
      'Pines digitales y analógicos, señales PWM y comunicación serial',
      'Integración de sensores y actuadores para control y adquisición de datos',
      'Montaje experimental sobre protoboard y diagnóstico de fallas',
    ],
  },
  {
    id: 'python-2',
    name: 'Fundamentos de Python 2 – Certified Associate Python Programmer',
    url: 'https://ctt-talleresfisei.uta.edu.ec/curso21.php',
    registrationUrl: 'https://ctt-talleresfisei.uta.edu.ec/curso21.php#inscripcion',
    instructors: 'Ing. Carlos Vargas, Mg.',
    modality: 'Virtual autodidacta (Self-paced) en Cisco NetAcad',
    location: 'Plataforma oficial Cisco NetAcad - CTT FISEI',
    hours: 40,
    dates: 'Del 16 de noviembre al 16 de diciembre de 2026',
    schedule: 'Modalidad autodidacta flexible a tu propio ritmo con soporte de la coordinación',
    registrationDates: 'Del 30 de octubre al 15 de noviembre de 2026',
    prices: {
      studentsUta: 40.0,
      graduatesTeachersUta: 50.0,
      generalPublic: 60.0,
    },
    description: 'Nivel 2 oficial de Cisco NetAcad. Profundiza en módulos, paquetes, PIP, excepciones, programación orientada a objetos (POO), herencia y manejo de archivos.',
    topics: [
      'Módulos, paquetes y gestor PIP para modularidad de software',
      'Procesamiento avanzado de cadenas de texto y manejo de excepciones robusto',
      'Programación orientada a objetos: clases, objetos, encapsulación y herencia',
      'Manejo de archivos de texto y binarios en entornos reales',
      'Preparación hacia la certificación Certified Associate Python Programmer (PCAP)',
    ],
  },
];

export const CTT_FISEI_INFO = {
  institution: 'Universidad Técnica de Ambato - FISEI',
  center: 'Centro de Transferencia y Desarrollo de Tecnologías (CTT-FISEI)',
  address: 'Av. Los Chasquis y Río Guayllabamba, Campus Huachi, Ambato, Ecuador',
  emails: ['talleresfisei@uta.edu.ec', 'ctt.fisei@uta.edu.ec'],
  certificateVerificationUrl: 'https://ctt-talleresfisei.uta.edu.ec/edu/mod/customcert/verify_certificate.php',
  catalogUrl: 'https://ctt-talleresfisei.uta.edu.ec/course.php',
};
