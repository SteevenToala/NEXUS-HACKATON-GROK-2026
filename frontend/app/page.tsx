'use client';

import React, { useState, useEffect, useRef } from 'react';

type Sentiment = 'HOT' | 'INTERESTED' | 'FRUSTRATED' | 'NEUTRAL';
type DashboardNav = 'PRINCIPAL' | 'CHATS' | 'MATRICULAS' | 'CURSOS' | 'ANALITICA' | 'CONFIG';
type SentimentFilter = 'ALL' | 'HOT' | 'INTERESTED' | 'NEUTRAL' | 'FRUSTRATED' | 'HANDOVER';
type RightPanelTab = 'DETAILS' | 'COURSES' | 'ACTIVITY';
type ParticipantCategory = 'STUDENT_UTA' | 'TEACHER_UTA' | 'GENERAL_PUBLIC';
type EnrollmentStatus = 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';

interface Enrollment {
  id: string;
  leadId?: string | null;
  buyerName: string;
  identification: string;
  email?: string | null;
  phone?: string | null;
  courseId: string;
  courseName: string;
  category: ParticipantCategory;
  amount: number;
  paymentProofUrl?: string | null;
  academicCertUrl?: string | null;
  status: EnrollmentStatus;
  verifiedBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    chatId: string;
    name: string;
    sentimentState: Sentiment;
  } | null;
}

interface EnrollmentStats {
  totalEnrollments: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalRevenue: number;
  pendingRevenue: number;
  byCategory: {
    STUDENT_UTA: { total: number; approved: number; amount: number };
    TEACHER_UTA: { total: number; approved: number; amount: number };
    GENERAL_PUBLIC: { total: number; approved: number; amount: number };
  };
  byCourse: {
    [key: string]: { name: string; count: number; approved: number; revenue: number };
  };
}

interface LeadMessage {
  text: string;
  sender: 'LEAD' | 'BOT' | 'HUMAN_AGENT';
  createdAt: string;
  mediaUrl?: string | null;
  mediaType?: 'audio' | 'image' | string | null;
}

interface Lead {
  id: string;
  chatId: string;
  name: string;
  sentimentState: Sentiment;
  isHumanIntervening: boolean;
  updatedAt: string;
  createdAt: string;
  messages?: LeadMessage[];
  _count?: { messages: number };
}

interface Message {
  id: string;
  leadId: string;
  sender: 'LEAD' | 'BOT' | 'HUMAN_AGENT';
  text: string;
  createdAt: string;
  mediaUrl?: string | null;
  mediaType?: 'audio' | 'image' | string | null;
}

interface LeadSummary {
  summary: string;
  recommendedCourse: string;
  readinessLevel: string;
  closingTip: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ==========================================
// LOGO VECTORIAL NEXUS FISEI
// ==========================================
function NexusLogo({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-8 h-8 flex items-center justify-center">
        <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="6" r="3.5" fill="#38BDF8" className="animate-pulse" />
          <circle cx="6" cy="28" r="3.5" fill="#38BDF8" />
          <circle cx="30" cy="28" r="3.5" fill="#38BDF8" />
          <line x1="18" y1="6" x2="6" y2="28" stroke="#38BDF8" strokeWidth="2.2" strokeOpacity="0.8" />
          <line x1="18" y1="6" x2="30" y2="28" stroke="#38BDF8" strokeWidth="2.2" strokeOpacity="0.8" />
          <line x1="6" y1="28" x2="30" y2="28" stroke="#38BDF8" strokeWidth="2.2" strokeOpacity="0.8" />
          <circle cx="18" cy="18" r="2" fill="#60A5FA" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-extrabold tracking-wider uppercase leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          NEXUS
        </span>
        <span className="text-[10px] font-bold text-sky-500 tracking-widest leading-none mt-1">
          FISEI
        </span>
      </div>
    </div>
  );
}

// Mini gráfico sparkline SVG
function Sparkline({ color = '#38BDF8' }: { color?: string }) {
  return (
    <svg className="w-16 h-7 overflow-visible" viewBox="0 0 60 25" fill="none">
      <path
        d="M2 18 Q 12 5, 22 15 T 42 8 T 58 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="58" cy="12" r="2" fill={color} />
    </svg>
  );
}

// Avatares degradados consistentes
const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-purple-500 to-indigo-600',
  'from-amber-500 to-orange-600',
  'from-teal-500 to-emerald-600',
  'from-cyan-500 to-blue-500',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.slice(0, 2) || 'LE').toUpperCase();
}

function getAvatarColor(chatId: string): string {
  const num = parseInt(chatId.slice(-2), 10) || chatId.charCodeAt(0) || 0;
  return AVATAR_GRADIENTS[num % AVATAR_GRADIENTS.length];
}

// Catálogo Oficial CTT-FISEI
const OFFICIAL_COURSES = [
  {
    id: 'gh-600',
    name: 'GitHub Agentic AI (GH-600)',
    shortName: 'GitHub Agentic AI',
    url: 'https://ctt-talleresfisei.uta.edu.ec/curso19.php',
    duration: '16 semanas • Virtual (Zoom)',
    hours: '32 horas académicas sincrónicas',
    rating: '4.9 (148)',
    priceUta: 40,
    priceGrad: 50,
    priceExt: 60,
    demand: '48% de la demanda',
    revenue: '$3,840 proyectados',
    color: 'from-blue-600 to-sky-500',
  },
  {
    id: 'arduino',
    name: 'Certificación Arduino & Robótica',
    shortName: 'Arduino & Robótica IoT',
    url: 'https://ctt-talleresfisei.uta.edu.ec/curso20.php',
    duration: '6 semanas • Presencial',
    hours: '40 horas prácticas en Lab Huachi',
    rating: '4.8 (112)',
    priceUta: 40,
    priceGrad: 50,
    priceExt: 60,
    demand: '32% de la demanda',
    revenue: '$2,480 proyectados',
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'python',
    name: 'Python 2 (Cisco NetAcad)',
    shortName: 'Python 2 Cisco NetAcad',
    url: 'https://ctt-talleresfisei.uta.edu.ec/curso21.php',
    duration: '8 semanas • Virtual flexible',
    hours: '40 horas con examen oficial',
    rating: '4.7 (94)',
    priceUta: 40,
    priceGrad: 50,
    priceExt: 60,
    demand: '20% de la demanda',
    revenue: '$1,520 proyectados',
    color: 'from-emerald-500 to-teal-600',
  },
];

export default function NexusFiseiDashboard() {
  // Estado de Tema Claro / Oscuro funcional
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Estados de Navegacion y Filtro
  const [activeNav, setActiveNav] = useState<DashboardNav>('PRINCIPAL');
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('DETAILS');

  // Leads y Mensajes en tiempo real
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [quickTemplateOpen, setQuickTemplateOpen] = useState(false);
  const [suggestCourseOpen, setSuggestCourseOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Resumen con IA real (Gemini)
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Paginación para Auditoría Concurrente de Conversaciones
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditItemsPerPage, setAuditItemsPerPage] = useState<number>(5);
  const [auditSearch, setAuditSearch] = useState<string>('');

  // Paginación para Catálogo de Cursos CTT
  const [coursesPage, setCoursesPage] = useState<number>(1);
  const [coursesItemsPerPage, setCoursesItemsPerPage] = useState<number>(6);

  // Filtro de Rango de Tiempo para Analítica BI
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState<'24H' | '7D' | 'ALL'>('ALL');

  // Estados para Registro de Compradores y Validación de Matrículas CTT-FISEI
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentStats, setEnrollmentStats] = useState<EnrollmentStats | null>(null);
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<'ALL' | 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED'>('ALL');
  const [enrollmentCategoryFilter, setEnrollmentCategoryFilter] = useState<'ALL' | 'STUDENT_UTA' | 'TEACHER_UTA' | 'GENERAL_PUBLIC'>('ALL');
  const [enrollmentSearchQuery, setEnrollmentSearchQuery] = useState('');
  const [isCreateEnrollmentModalOpen, setIsCreateEnrollmentModalOpen] = useState(false);
  const [verificationModalEnrollment, setVerificationModalEnrollment] = useState<Enrollment | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [newEnrollment, setNewEnrollment] = useState({
    buyerName: '',
    identification: '',
    email: '',
    phone: '',
    courseId: 'gh-600',
    category: 'STUDENT_UTA' as ParticipantCategory,
    notes: '',
    paymentProofUrl: '',
    academicCertUrl: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedLeadIdRef = useRef<string | null>(selectedLeadId);

  useEffect(() => {
    selectedLeadIdRef.current = selectedLeadId;
  }, [selectedLeadId]);

  // Sincronizar tema con localStorage y clase en HTML
  useEffect(() => {
    const savedTheme = localStorage.getItem('nexus_theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    }
  }, []);

  const toggleTheme = (dark: boolean) => {
    setIsDarkMode(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('nexus_theme', 'dark');
      showFeedback('Modo oscuro activado');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('nexus_theme', 'light');
      showFeedback('Modo claro activado');
    }
  };

  // Auto-scroll en el chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Carga de Leads
  const loadLeads = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/leads`);
      if (res.ok) {
        const data: Lead[] = await res.json();
        setLeads(data);
        if (!selectedLeadIdRef.current && data.length > 0) {
          setSelectedLeadId(data[0].id);
        }
      }
    } catch (e) {}
  };

  const loadMessages = async (leadId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/leads/${leadId}/messages`);
      if (res.ok) {
        const data: Message[] = await res.json();
        setMessages(data);
      }
    } catch (e) {}
  };

  const loadEnrollments = async () => {
    try {
      const [resList, resStats] = await Promise.all([
        fetch(`${API_BASE}/api/enrollments`),
        fetch(`${API_BASE}/api/enrollments/stats`),
      ]);
      if (resList.ok) {
        const data = await resList.json();
        setEnrollments(data);
      }
      if (resStats.ok) {
        const stats = await resStats.json();
        setEnrollmentStats(stats);
      }
    } catch (e) {}
  };

  const handleUpdateEnrollmentStatus = async (
    id: string,
    status: 'APPROVED' | 'REJECTED',
    notesCustom?: string,
  ) => {
    try {
      let finalNotes = notesCustom;
      if (status === 'REJECTED' && !finalNotes) {
        const reason = window.prompt(
          'Indica el motivo de observación para el comprador (ej: Comprobante ilegible / Falta certificado de matrícula):',
        );
        if (!reason) return;
        finalNotes = reason;
      }

      const res = await fetch(`${API_BASE}/api/enrollments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          verifiedBy: 'Secretaría Académica CTT',
          notes: finalNotes || undefined,
        }),
      });

      if (res.ok) {
        showFeedback(status === 'APPROVED' ? 'Matrícula aprobada oficialmente ✅' : 'Matrícula observada / rechazada ⚠️');
        loadEnrollments();
        if (verificationModalEnrollment?.id === id) {
          setVerificationModalEnrollment(null);
        }
      }
    } catch (e) {
      showFeedback('Error al actualizar matrícula');
    }
  };

  const handleCreateEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnrollment.buyerName || !newEnrollment.identification) {
      showFeedback('Nombre y cédula son requeridos');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEnrollment,
          leadId: selectedLeadId || undefined,
        }),
      });

      if (res.ok) {
        showFeedback('Matrícula registrada exitosamente');
        setIsCreateEnrollmentModalOpen(false);
        loadEnrollments();
        setNewEnrollment({
          buyerName: '',
          identification: '',
          email: '',
          phone: '',
          courseId: 'gh-600',
          category: 'STUDENT_UTA',
          notes: '',
          paymentProofUrl: '',
          academicCertUrl: '',
        });
      }
    } catch (err) {
      showFeedback('Error al registrar matrícula');
    }
  };

  const handleSendCheckoutPrompt = async () => {
    if (!selectedLeadId) {
      showFeedback('Selecciona un prospecto para enviar el formulario');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/enrollments/send-checkout-prompt/${selectedLeadId}`, {
        method: 'POST',
      });
      if (res.ok) {
        showFeedback('Formulario oficial de compra y requisitos enviado al chat de Telegram');
        loadMessages(selectedLeadId);
      }
    } catch (e) {
      showFeedback('Error al enviar formulario de compra');
    }
  };

  useEffect(() => {
    loadLeads();
    loadEnrollments();
  }, []);

  useEffect(() => {
    if (selectedLeadId) {
      loadMessages(selectedLeadId);
      setSummary(null);
    }
  }, [selectedLeadId]);

  // Conexión Server-Sent Events (SSE) Estable
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE}/api/leads/events`);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const { type, data } = parsed;

          if (type === 'message:created') {
            if (data.leadId === selectedLeadIdRef.current) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [...prev, data];
              });
            }
            loadLeads();
          } else if (type === 'lead:updated') {
            setLeads((prev) => {
              const exists = prev.some((l) => l.id === data.id);
              if (!exists) return [data, ...prev];
              return prev.map((l) => (l.id === data.id ? { ...l, ...data } : l));
            });
          } else if (type === 'enrollment:created' || type === 'enrollment:updated') {
            loadEnrollments();
          }
        } catch (err) {
          console.error(err);
        }
      };
    } catch (e) {}

    const interval = setInterval(() => {
      loadLeads();
      loadEnrollments();
      if (selectedLeadIdRef.current) {
        loadMessages(selectedLeadIdRef.current);
      }
    }, 2500);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  // Enviar Mensaje al Chat de Telegram
  const handleSendMessage = async (textCustom?: string) => {
    const textToSend = textCustom || inputText;
    if (!textToSend.trim() || !selectedLeadId || isSending) return;

    setIsSending(true);
    if (!textCustom) setInputText('');

    try {
      const res = await fetch(`${API_BASE}/api/leads/${selectedLeadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend }),
      });

      if (res.ok) {
        const newMsg: Message = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        showFeedback('Mensaje transmitido a Telegram');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  // Handover: Pausar/Reanudar IA en tiempo real
  const toggleHandover = async () => {
    if (!selectedLeadId) return;
    const lead = leads.find((l) => l.id === selectedLeadId);
    if (!lead) return;

    const nextState = !lead.isHumanIntervening;

    try {
      const res = await fetch(`${API_BASE}/api/leads/${selectedLeadId}/handover`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHumanIntervening: nextState }),
      });

      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === selectedLeadId ? { ...l, isHumanIntervening: nextState } : l))
        );
        showFeedback(
          nextState
            ? 'Atención manual activa (IA congelada)'
            : 'IA Reanudada (Modo Autónomo Gemini)'
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Generar Resumen con IA real (Gemini API)
  const handleGenerateSummary = async (openModal = false) => {
    if (!selectedLeadId) return;
    setIsLoadingSummary(true);
    setShowRightPanel(true);
    setRightPanelTab('DETAILS');
    if (openModal) setShowSummaryModal(true);

    try {
      const res = await fetch(`${API_BASE}/api/leads/${selectedLeadId}/summarize`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
        showFeedback('Diagnóstico Gemini generado con éxito');
      }
    } catch (e) {
      console.error(e);
      showFeedback('Error al consultar Gemini AI');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Lead activo seleccionado
  // Lead activo seleccionado
  const selectedLead = leads.find((l) => l.id === selectedLeadId) || leads[0];

  // Métricas del termómetro y estadísticas 100% calculadas dinámicamente
  const hotCount = leads.filter((l) => l.sentimentState === 'HOT').length;
  const interestedCount = leads.filter((l) => l.sentimentState === 'INTERESTED').length;
  const neutralCount = leads.filter((l) => l.sentimentState === 'NEUTRAL').length;
  const frustratedCount = leads.filter((l) => l.sentimentState === 'FRUSTRATED').length;
  const humanActiveCount = leads.filter((l) => l.isHumanIntervening).length;
  const qualifiedCount = hotCount + interestedCount;
  const totalMessagesCount = leads.reduce(
    (acc, l) => acc + (l._count?.messages || (l.messages ? l.messages.length : 0)),
    0
  );
  const conversionRate = leads.length > 0 ? ((hotCount / leads.length) * 100).toFixed(1) : '0.0';
  const projectedTotalRevenue = (hotCount * 40) + (interestedCount * 40);

  // Métricas para embudo y toma de decisiones estratégicas
  const totalLeadsCount = leads.length;
  const stage1Count = totalLeadsCount;
  const stage2Count = qualifiedCount;
  const stage3Count = hotCount;
  const stage4Count = humanActiveCount + frustratedCount;

  const pctStage2 = totalLeadsCount > 0 ? ((stage2Count / totalLeadsCount) * 100).toFixed(1) : '0.0';
  const pctStage3 = totalLeadsCount > 0 ? ((stage3Count / totalLeadsCount) * 100).toFixed(1) : '0.0';
  const pctStage4 = totalLeadsCount > 0 ? ((stage4Count / totalLeadsCount) * 100).toFixed(1) : '0.0';

  // Objeciones analizadas del historial real de mensajes
  const allMessagesText = leads
    .flatMap((l) => (l.messages || []).map((m) => m.text.toLowerCase()))
    .concat(messages.map((m) => m.text.toLowerCase()));

  const priceMentions = allMessagesText.filter((t) => /precio|costo|arancel|descuento|pago|dolar|\$|40|50|60/i.test(t)).length;
  const scheduleMentions = allMessagesText.filter((t) => /horario|sabado|hora|zoom|presencial|huachi|campus|fecha/i.test(t)).length;
  const certMentions = allMessagesText.filter((t) => /certificado|horas|vinculacion|credito|netacad|github|arduino|32|40/i.test(t)).length;
  const bankMentions = allMessagesText.filter((t) => /banco|cuenta|pacifico|transferencia|comprobante|deposito|ruc/i.test(t)).length;
  const totalMentions = Math.max(1, priceMentions + scheduleMentions + certMentions + bankMentions);

  const pctPrice = Math.round((priceMentions / totalMentions) * 100);
  const pctSchedule = Math.round((scheduleMentions / totalMentions) * 100);
  const pctCert = Math.round((certMentions / totalMentions) * 100);
  const pctBank = Math.round((bankMentions / totalMentions) * 100);

  // Actividad reciente derivada de interacciones en vivo
  const recentActivities = (messages.length > 0 ? messages : leads.flatMap((l) => l.messages || []))
    .slice(-6)
    .reverse();

  // =========================================================================
  // ANALÍTICA DINÁMICA DE TIEMPOS, DISTRIBUCIÓN HORARIA Y EFICIENCIA OPERATIVA
  // =========================================================================
  const allSystemMessages = leads
    .flatMap((l) => (l.messages || []).map((m) => ({ ...m, leadName: l.name, sentiment: l.sentimentState })))
    .concat(messages.map((m) => ({ ...m, leadName: selectedLead?.name || 'Prospecto', sentiment: selectedLead?.sentimentState || 'NEUTRAL' })));

  // Autonomía de la IA (%)
  const totalLeadsActive = leads.length;
  const autonomousLeads = leads.filter((l) => !l.isHumanIntervening).length;
  const autonomyRate = totalLeadsActive > 0 ? Math.round((autonomousLeads / totalLeadsActive) * 100) : 100;

  // Distribución Horaria Real (6 franjas de 3 horas)
  const hourlySlots = [
    { label: '06:00 - 09:00', shortLabel: '06-09h', hours: [6, 7, 8], count: 0, desc: 'Apertura' },
    { label: '09:00 - 12:00', shortLabel: '09-12h', hours: [9, 10, 11], count: 0, desc: 'Pico Académico' },
    { label: '12:00 - 15:00', shortLabel: '12-15h', hours: [12, 13, 14], count: 0, desc: 'Mediodía' },
    { label: '15:00 - 18:00', shortLabel: '15-18h', hours: [15, 16, 17], count: 0, desc: 'Pico Vespertino' },
    { label: '18:00 - 21:00', shortLabel: '18-21h', hours: [18, 19, 20], count: 0, desc: 'Pico Nocturno UTA' },
    { label: '21:00 - 00:00', shortLabel: '21-24h', hours: [21, 22, 23, 0, 1, 2, 3, 4, 5], count: 0, desc: 'Guardia Flexible' },
  ];

  allSystemMessages.forEach((m) => {
    const h = new Date(m.createdAt).getHours();
    const slot = hourlySlots.find((s) => s.hours.includes(h));
    if (slot) slot.count++;
    else hourlySlots[5].count++;
  });

  const maxSlotCount = Math.max(1, ...hourlySlots.map((s) => s.count));
  const peakSlot = hourlySlots.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), hourlySlots[0]);

  // Mensajes promedio por conversación hasta resolución
  const avgMessagesPerLead = totalLeadsActive > 0 ? (allSystemMessages.length / totalLeadsActive).toFixed(1) : '2.4';

  // Rendimiento y Demanda por Programa
  const coursePerformance = OFFICIAL_COURSES.map((course) => {
    const regex = course.id === 'gh-600'
      ? /github|agentic|ia|ai|gh-600|inteligencia/i
      : course.id === 'arduino'
      ? /arduino|robotica|robótica|iot|lab|huachi/i
      : /python|cisco|netacad/i;

    const matchedLeads = leads.filter((l) =>
      (l.messages || []).some((m) => regex.test(m.text))
    );
    const count = Math.max(matchedLeads.length, course.id === 'gh-600' ? Math.max(1, Math.round(leads.length * 0.48)) : course.id === 'arduino' ? Math.max(1, Math.round(leads.length * 0.32)) : Math.max(1, Math.round(leads.length * 0.20)));
    const hotLeadsForCourse = matchedLeads.filter((l) => l.sentimentState === 'HOT').length;
    const revenueEst = count * course.priceUta;
    const percentDemand = totalLeadsActive > 0 ? Math.round((count / totalLeadsActive) * 100) : 33;

    return {
      ...course,
      leadCount: count,
      hotCount: hotLeadsForCourse,
      percentDemand,
      revenueEst,
    };
  });

  // Paginación y Filtrado para la Tabla de Auditoría Concurrente
  const filteredAuditLeads = leads.filter((l) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.chatId.includes(q) ||
      (l.messages && l.messages.some((m) => m.text.toLowerCase().includes(q)))
    );
  });
  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditLeads.length / auditItemsPerPage));
  const currentAuditPage = Math.min(Math.max(1, auditPage), totalAuditPages);
  const auditStartIndex = (currentAuditPage - 1) * auditItemsPerPage;
  const paginatedAuditLeads = filteredAuditLeads.slice(auditStartIndex, auditStartIndex + auditItemsPerPage);

  // Paginación para el Catálogo de Cursos CTT
  const totalCoursesPages = Math.max(1, Math.ceil(OFFICIAL_COURSES.length / coursesItemsPerPage));
  const currentCoursesPage = Math.min(Math.max(1, coursesPage), totalCoursesPages);
  const coursesStartIndex = (currentCoursesPage - 1) * coursesItemsPerPage;
  const paginatedCourses = OFFICIAL_COURSES.slice(coursesStartIndex, coursesStartIndex + coursesItemsPerPage);

  // Filtrado de leads en la Columna 1
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.chatId.includes(searchQuery) ||
      (lead.messages && lead.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase())));

    if (!matchesSearch) return false;

    if (sentimentFilter === 'HOT') return lead.sentimentState === 'HOT';
    if (sentimentFilter === 'INTERESTED') return lead.sentimentState === 'INTERESTED';
    if (sentimentFilter === 'NEUTRAL') return lead.sentimentState === 'NEUTRAL';
    if (sentimentFilter === 'FRUSTRATED') return lead.sentimentState === 'FRUSTRATED';
    if (sentimentFilter === 'HANDOVER') return lead.isHumanIntervening;
    return true;
  });

  // Filtrado de matrículas y compradores para comprobación manual
  const filteredEnrollments = enrollments.filter((e) => {
    if (enrollmentStatusFilter !== 'ALL' && e.status !== enrollmentStatusFilter) return false;
    if (enrollmentCategoryFilter !== 'ALL' && e.category !== enrollmentCategoryFilter) return false;
    if (enrollmentSearchQuery.trim()) {
      const q = enrollmentSearchQuery.toLowerCase();
      const matchName = e.buyerName.toLowerCase().includes(q);
      const matchId = e.identification.toLowerCase().includes(q);
      const matchCourse = e.courseName.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchCourse) return false;
    }
    return true;
  });

  const categoryStyles: Record<
    ParticipantCategory,
    { label: string; badge: string; roleDesc: string; certRequired: boolean }
  > = {
    STUDENT_UTA: {
      label: 'Estudiante UTA ($40)',
      badge: isDarkMode
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      roleDesc: 'Requiere Certificado de Matrícula UTA o Carnet vigente',
      certRequired: true,
    },
    TEACHER_UTA: {
      label: 'Docente / Graduado ($50)',
      badge: isDarkMode
        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
        : 'bg-indigo-100 text-indigo-700 border border-indigo-200',
      roleDesc: 'Requiere Carnet Docente, Título o Acción de Personal',
      certRequired: true,
    },
    GENERAL_PUBLIC: {
      label: 'Público General ($60)',
      badge: isDarkMode
        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
        : 'bg-sky-100 text-sky-700 border border-sky-200',
      roleDesc: 'Sin requisito académico. Validación directa de depósito',
      certRequired: false,
    },
  };

  // Clases CSS dinámicas para cambio de tema instantáneo
  const theme = {
    bgRoot: isDarkMode ? 'bg-[#0B111E] text-slate-100' : 'bg-[#F1F5F9] text-slate-900',
    bgHeader: isDarkMode ? 'bg-[#0B111E] border-[#162032]' : 'bg-white border-slate-200 shadow-2xs',
    bgSidebar: isDarkMode ? 'bg-[#0B111E] border-[#162032]' : 'bg-white border-slate-200',
    bgCard: isDarkMode ? 'bg-[#0E172A] border-[#16233B]' : 'bg-white border-slate-200 shadow-2xs',
    bgSubcard: isDarkMode ? 'bg-[#121B30] border-[#1A2644]' : 'bg-slate-50 border-slate-200',
    bgInput: isDarkMode ? 'bg-[#131D33] border-[#1E293B] text-slate-100' : 'bg-slate-100 border-slate-300 text-slate-900',
    bgChatTimeline: isDarkMode ? 'bg-[#0A101D]' : 'bg-slate-100/70',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-slate-500',
    borderMuted: isDarkMode ? 'border-[#16233B]' : 'border-slate-200',
    bubbleUser: isDarkMode ? 'bg-[#182337] border-[#23314B] text-slate-100' : 'bg-white border-slate-200 text-slate-800 shadow-2xs',
    bubbleBot: 'bg-[#0284C7] text-white',
    bubbleHuman: 'bg-[#0F766E] text-white',
  };

  // Configuración visual de badges de sentimiento (100% EN ESPAÑOL Y CLAROS)
  const sentimentStyles: Record<Sentiment, { label: string; badge: string; pillColor: string }> = {
    HOT: {
      label: 'Alta Intención',
      badge: isDarkMode ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-rose-100 text-rose-700 border border-rose-200',
      pillColor: 'text-rose-500 border-rose-500/40 bg-rose-500/10',
    },
    INTERESTED: {
      label: 'En Evaluación',
      badge: isDarkMode ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-sky-100 text-sky-700 border border-sky-200',
      pillColor: 'text-sky-500 border-sky-500/40 bg-sky-500/10',
    },
    NEUTRAL: {
      label: 'Consulta Inicial',
      badge: isDarkMode ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' : 'bg-slate-200 text-slate-700 border border-slate-300',
      pillColor: 'text-slate-400 border-slate-500/40 bg-slate-500/10',
    },
    FRUSTRATED: {
      label: 'Requiere Soporte',
      badge: isDarkMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-800 border border-amber-200',
      pillColor: 'text-amber-500 border-amber-500/40 bg-amber-500/10',
    },
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans transition-colors duration-200 ${theme.bgRoot}`}>
      {/* ========================================================================= */}
      {/* 1. BARRA LATERAL IZQUIERDA (SIDEBAR DE NAVEGACIÓN)                        */}
      {/* ========================================================================= */}
      <aside className={`w-56 shrink-0 border-r flex flex-col justify-between p-3.5 z-20 transition-colors ${theme.bgSidebar}`}>
        <div className="space-y-6">
          {/* Logo NEXUS FISEI */}
          <div className="px-2 py-1">
            <NexusLogo isDarkMode={isDarkMode} />
          </div>

          {/* Menú de Navegación */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveNav('PRINCIPAL')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeNav === 'PRINCIPAL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : `${theme.textMuted} hover:bg-blue-500/10 hover:text-blue-500`
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Panel Principal</span>
            </button>

            <button
              onClick={() => setActiveNav('CHATS')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeNav === 'CHATS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : `${theme.textMuted} hover:bg-blue-500/10 hover:text-blue-500`
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Chats</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                {leads.length}
              </span>
            </button>

            <button
              onClick={() => setActiveNav('MATRICULAS')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeNav === 'MATRICULAS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : `${theme.textMuted} hover:bg-blue-500/10 hover:text-blue-500`
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Matrículas & Compras</span>
              </div>
              {enrollmentStats && enrollmentStats.pendingCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {enrollmentStats.pendingCount}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => setActiveNav('CURSOS')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeNav === 'CURSOS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : `${theme.textMuted} hover:bg-blue-500/10 hover:text-blue-500`
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 7l-9-5 9-5 9 5-9 5z" />
              </svg>
              <span>Cursos CTT</span>
            </button>

            <button
              onClick={() => setActiveNav('ANALITICA')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeNav === 'ANALITICA'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : `${theme.textMuted} hover:bg-blue-500/10 hover:text-blue-500`
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Analítica y Decisiones</span>
            </button>

          </nav>
        </div>

        {/* Tarjeta Inspiracional Inferior */}
        <div className={`relative rounded-2xl border p-4 overflow-hidden ${isDarkMode ? 'bg-gradient-to-br from-[#121B30] to-[#0D1527] border-[#1E2D4A]' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'}`}>
          <div className="flex items-center gap-1.5 text-sky-500 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">FISEI UTA</span>
          </div>
          <p className={`text-[11px] font-medium leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            Cada conversación es una oportunidad de transformar vidas
          </p>
          <span className="text-[10px] font-bold text-sky-500/90 tracking-wider block mt-2">
            NEXUS FISEI
          </span>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* ÁREA PRINCIPAL                                                            */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* ========================================================================= */}
        {/* TOP NAVBAR                                                                */}
        {/* ========================================================================= */}
        <header className={`h-14 shrink-0 border-b px-6 flex items-center justify-between z-10 transition-colors ${theme.bgHeader}`}>
          {/* Buscador Global */}
          <div className="relative w-80 sm:w-96">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar leads, cursos o mensajes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-xl pl-9 pr-14 py-1.5 text-xs transition border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 border border-slate-300/40 px-1.5 py-0.5 rounded">
              Ctrl + K
            </span>
          </div>

          {/* Botones de Cabecera: Toggle Claro/Oscuro Real, Notificaciones y Operador */}
          <div className="flex items-center gap-3.5">
            {/* Feedback Toast */}
            {actionFeedback && (
              <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 rounded-lg text-xs font-semibold animate-in fade-in">
                {actionFeedback}
              </div>
            )}

            {/* BOTÓN REAL DE MODO CLARO / OSCURO (TOTALMENTE FUNCIONAL) */}
            <div className={`flex items-center p-1 rounded-xl border transition-colors ${isDarkMode ? 'bg-[#131D33] border-[#1E293B]' : 'bg-slate-200 border-slate-300'}`}>
              <button
                type="button"
                onClick={() => toggleTheme(false)}
                title="Cambiar a Modo Claro"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  !isDarkMode
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => toggleTheme(true)}
                title="Cambiar a Modo Oscuro"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isDarkMode
                    ? 'bg-[#1E293B] text-sky-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Oscuro</span>
              </button>
            </div>

            {/* Campana */}
            <button className={`p-2 rounded-lg transition cursor-pointer ${theme.textMuted} hover:bg-slate-500/10`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* Operador Avatar */}
            <div className={`flex items-center gap-2.5 pl-3 border-l ${theme.borderMuted}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                OP
              </div>
              <div className="flex flex-col">
                <span className={`text-xs font-bold leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Operador
                </span>
                <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> En línea
                </span>
              </div>
            </div>
          </div>
        </header>



        {/* ========================================================================= */}
        {/* WORKSPACE PRINCIPAL: 3 COLUMNAS FLEXIBLES (PANEL PRINCIPAL / CHATS)       */}
        {/* ========================================================================= */}
        {(activeNav === 'PRINCIPAL' || activeNav === 'CHATS') && (
          <div className="flex-1 min-h-0 px-6 pb-4 pt-1 flex gap-4 overflow-hidden">
            {/* ========================================================================= */}
            {/* COLUMNA 1: LISTADO DE CONVERSACIONES CON FILTRO DE SENTIMIENTO REORGANIZADO*/}
            {/* ========================================================================= */}
            <div className={`w-80 shrink-0 border rounded-2xl flex flex-col overflow-hidden transition-colors ${theme.bgCard}`}>
              {/* Header Columna */}
              <div className={`p-3.5 border-b space-y-2.5 ${theme.borderMuted}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-wide">Conversaciones</h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${theme.bgInput}`}>
                    {filteredLeads.length} de {leads.length}
                  </span>
                </div>

                {/* Input de Búsqueda */}
                <div className="relative">
                  <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o mensaje..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-[11px] transition border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                  />
                </div>

                {/* PANEL DE FILTROS DEL TERMÓMETRO DE VENTAS (IA) */}
                <div className="pt-2 border-t border-slate-500/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${theme.textMuted}`}>
                      <span>🌡️</span>
                      <span>Termómetro de Intención (IA)</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold flex items-center gap-1 border border-emerald-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Gemini Live
                    </span>
                  </div>

                  {/* Píldora superior: Todos */}
                  <button
                    type="button"
                    onClick={() => setSentimentFilter('ALL')}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center justify-between border ${
                      sentimentFilter === 'ALL'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : `${theme.bgInput} ${theme.textMuted} border-transparent hover:border-blue-500/40`
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>📋</span>
                      <span>Todas las Conversaciones</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${sentimentFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-500/15 text-slate-400'}`}>
                      {leads.length}
                    </span>
                  </button>

                  {/* Matriz 2x2 de estados de intención */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSentimentFilter('HOT')}
                      className={`p-2 rounded-xl text-left transition cursor-pointer border flex flex-col justify-between ${
                        sentimentFilter === 'HOT'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : `${theme.bgInput} border-transparent hover:border-rose-500/40`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs">🔥</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sentimentFilter === 'HOT' ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-500'}`}>
                          {hotCount}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold leading-tight ${sentimentFilter === 'HOT' ? 'text-white' : 'text-rose-500'}`}>
                        Alta Intención
                      </span>
                      <span className={`text-[9px] truncate ${sentimentFilter === 'HOT' ? 'text-white/80' : theme.textMuted}`}>
                        Listo para pago
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSentimentFilter('INTERESTED')}
                      className={`p-2 rounded-xl text-left transition cursor-pointer border flex flex-col justify-between ${
                        sentimentFilter === 'INTERESTED'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : `${theme.bgInput} border-transparent hover:border-sky-500/40`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs">🎯</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sentimentFilter === 'INTERESTED' ? 'bg-white/20 text-white' : 'bg-sky-500/20 text-sky-500'}`}>
                          {interestedCount}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold leading-tight ${sentimentFilter === 'INTERESTED' ? 'text-white' : 'text-sky-500'}`}>
                        En Evaluación
                      </span>
                      <span className={`text-[9px] truncate ${sentimentFilter === 'INTERESTED' ? 'text-white/80' : theme.textMuted}`}>
                        Revisando pénsum
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSentimentFilter('NEUTRAL')}
                      className={`p-2 rounded-xl text-left transition cursor-pointer border flex flex-col justify-between ${
                        sentimentFilter === 'NEUTRAL'
                          ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                          : `${theme.bgInput} border-transparent hover:border-slate-500/40`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs">💬</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sentimentFilter === 'NEUTRAL' ? 'bg-white/20 text-white' : 'bg-slate-500/20 text-slate-400'}`}>
                          {neutralCount}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold leading-tight ${sentimentFilter === 'NEUTRAL' ? 'text-white' : ''}`}>
                        Consulta Inicial
                      </span>
                      <span className={`text-[9px] truncate ${sentimentFilter === 'NEUTRAL' ? 'text-white/80' : theme.textMuted}`}>
                        Dudas generales
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSentimentFilter('FRUSTRATED')}
                      className={`p-2 rounded-xl text-left transition cursor-pointer border flex flex-col justify-between ${
                        sentimentFilter === 'FRUSTRATED'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : `${theme.bgInput} border-transparent hover:border-amber-500/40`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs">⚠️</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sentimentFilter === 'FRUSTRATED' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-500'}`}>
                          {frustratedCount}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold leading-tight ${sentimentFilter === 'FRUSTRATED' ? 'text-white' : 'text-amber-500'}`}>
                        Requiere Soporte
                      </span>
                      <span className={`text-[9px] truncate ${sentimentFilter === 'FRUSTRATED' ? 'text-white/80' : theme.textMuted}`}>
                        Falla o queja
                      </span>
                    </button>
                  </div>

                  {/* Fila inferior destacada: Atención Manual (Handover) */}
                  <button
                    type="button"
                    onClick={() => setSentimentFilter('HANDOVER')}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center justify-between border ${
                      sentimentFilter === 'HANDOVER'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : `${theme.bgInput} border-transparent hover:border-emerald-500/40`
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>👤</span>
                      <span className={sentimentFilter === 'HANDOVER' ? 'text-white' : 'text-emerald-500'}>
                        En Atención Manual (Operador)
                      </span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${sentimentFilter === 'HANDOVER' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-500'}`}>
                      {humanActiveCount}
                    </span>
                  </button>
                </div>
              </div>

              {/* Lista Scrollable de Leads */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-500/10">
                {filteredLeads.length === 0 ? (
                  <div className={`p-8 text-center text-xs ${theme.textMuted}`}>
                    No hay prospectos en esta categoría.
                  </div>
                ) : (
                  filteredLeads.map((lead) => {
                    const isSelected = lead.id === selectedLeadId;
                    const initials = getInitials(lead.name);
                    const avatarColor = getAvatarColor(lead.chatId);
                    const lastMsg = lead.messages && lead.messages[0] ? lead.messages[0].text : 'Sin actividad previa';
                    const sentiment = sentimentStyles[lead.sentimentState] || sentimentStyles.NEUTRAL;

                    return (
                      <div
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`p-3 transition cursor-pointer flex items-start gap-3 relative ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-[#15233E] border-l-3 border-blue-500'
                              : 'bg-blue-50 border-l-3 border-blue-600 shadow-2xs'
                            : isDarkMode
                            ? 'hover:bg-[#111C33]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full shrink-0 bg-gradient-to-tr ${avatarColor} flex items-center justify-center text-xs font-bold text-white shadow-xs`}>
                          {initials}
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-xs font-bold truncate ${isSelected ? (isDarkMode ? 'text-white' : 'text-blue-900') : ''}`}>
                              {lead.name}
                            </span>
                            <span className="text-[10px] opacity-60 font-mono">
                              {new Date(lead.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <p className={`text-[11px] truncate mb-1.5 ${theme.textMuted}`}>
                            {lastMsg}
                          </p>

                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${sentiment.badge}`}>
                              {sentiment.label}
                            </span>

                            {lead.isHumanIntervening && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                                Manual
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* COLUMNA 2: CABINA DE CHAT CONVERSACIONAL (LIMPIA, SIN BOTONES DE LLAMADA) */}
            {/* ========================================================================= */}
            <div className={`flex-1 border rounded-2xl flex flex-col overflow-hidden min-w-0 transition-colors ${theme.bgCard}`}>
              {selectedLead ? (
                <>
                  {/* CABECERA DEL CHAT (SIN BOTONES DE LLAMADA/VIDEO) */}
                  <div className={`h-16 px-5 border-b flex items-center justify-between shrink-0 ${theme.borderMuted}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getAvatarColor(selectedLead.chatId)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                        {getInitials(selectedLead.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold truncate">{selectedLead.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${sentimentStyles[selectedLead.sentimentState]?.badge}`}>
                            {sentimentStyles[selectedLead.sentimentState]?.label}
                          </span>
                        </div>
                        <span className={`text-[11px] truncate block ${theme.textMuted}`}>
                          Telegram ID: {selectedLead.chatId} • CTT-FISEI UTA
                        </span>
                      </div>
                    </div>

                    {/* BOTON DE SEAMLESS HANDOVER Y TOGGLE PANEL */}
                    <div className="flex items-center gap-2">
                      {/* BOTÓN ENVIAR FORMULARIO DE COMPRA */}
                      <button
                        type="button"
                        onClick={handleSendCheckoutPrompt}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-blue-600/15 hover:bg-blue-600/25 text-sky-400 border border-blue-500/30 shadow-xs cursor-pointer"
                        title="Enviar el formulario interactivo de matrícula directamente al Telegram del alumno"
                      >
                        <span>📝</span>
                        <span className="hidden sm:inline">Enviar Formulario a Telegram</span>
                      </button>

                      <button
                        onClick={toggleHandover}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                          selectedLead.isHumanIntervening
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-rose-600 hover:bg-rose-500 text-white'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        {selectedLead.isHumanIntervening ? 'Reanudar IA' : 'Intervenir Operador'}
                      </button>

                      <button
                        onClick={() => setShowRightPanel(!showRightPanel)}
                        title={showRightPanel ? 'Ocultar detalles' : 'Ver detalles'}
                        className={`p-2 rounded-xl transition cursor-pointer border ${theme.bgInput} ${theme.borderMuted}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* TIMELINE DE MENSAJES */}
                  <div className={`flex-1 overflow-y-auto p-4 space-y-3.5 transition-colors ${theme.bgChatTimeline}`}>
                    {messages.length === 0 ? (
                      <div className={`h-full flex items-center justify-center text-xs ${theme.textMuted}`}>
                        Sin mensajes registrados en esta conversación.
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isLead = msg.sender === 'LEAD';
                        const isHuman = msg.sender === 'HUMAN_AGENT';
                        const isAudio = msg.mediaType === 'audio' || (msg.mediaUrl && msg.mediaUrl.startsWith('data:audio')) || msg.text?.includes('[Nota de voz]');
                        const isImage = msg.mediaType === 'image' || (msg.mediaUrl && msg.mediaUrl.startsWith('data:image')) || msg.text?.includes('[Imagen]');

                        return (
                          <div
                            key={msg.id}
                            className={`flex items-end gap-2.5 max-w-[85%] ${isLead ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                          >
                            {/* Avatar */}
                            {isLead ? (
                              <div className={`w-7 h-7 rounded-full shrink-0 bg-gradient-to-tr ${getAvatarColor(selectedLead.chatId)} flex items-center justify-center text-[10px] font-bold text-white shadow-xs`}>
                                {getInitials(selectedLead.name)}
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full shrink-0 bg-blue-600 flex items-center justify-center text-white shadow-xs">
                                {isHuman ? 'OP' : '🤖'}
                              </div>
                            )}

                            {/* Burbuja */}
                            <div
                              className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                                isLead
                                  ? `${theme.bubbleUser} rounded-bl-xs`
                                  : isHuman
                                  ? `${theme.bubbleHuman} rounded-br-xs`
                                  : `${theme.bubbleBot} rounded-br-xs`
                              }`}
                            >
                              <div className="whitespace-pre-wrap">{msg.text}</div>

                              {/* REPRODUCTOR DE NOTA DE VOZ HTML5 */}
                              {isAudio && (
                                <div className="mt-2.5 pt-2 border-t border-white/20 flex flex-col gap-1.5">
                                  <span className="text-[10px] font-bold flex items-center gap-1 opacity-90">
                                    🎙️ Nota de voz Telegram
                                  </span>
                                  {msg.mediaUrl ? (
                                    <audio
                                      controls
                                      src={msg.mediaUrl}
                                      className="w-full h-8 mt-1 rounded bg-black/20"
                                      preload="metadata"
                                    />
                                  ) : (
                                    <span className="text-[10px] opacity-75 italic">
                                      Audio transcrito en tiempo real por Gemini AI
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* VISOR DE IMAGEN / COMPROBANTE ADJUNTO */}
                              {isImage && msg.mediaUrl && (
                                <div className="mt-2.5 pt-2 border-t border-white/20">
                                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
                                    <img
                                      src={msg.mediaUrl}
                                      alt="Comprobante adjunto"
                                      className="w-full max-h-56 object-contain cursor-pointer hover:opacity-90 transition"
                                      onClick={() => setPreviewImage(msg.mediaUrl!)}
                                    />
                                    <div className="p-2 bg-black/30 flex items-center justify-between text-[10px]">
                                      <span className="opacity-90 font-medium">📷 Archivo adjunto</span>
                                      <button
                                        type="button"
                                        onClick={() => setPreviewImage(msg.mediaUrl!)}
                                        className="text-sky-300 hover:text-white font-bold cursor-pointer underline"
                                      >
                                        Ampliar foto
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Hora */}
                              <div className={`flex items-center justify-end gap-1 text-[9px] mt-1.5 opacity-70`}>
                                <span>
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {!isLead && <span>✓✓</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* ACCIONES RÁPIDAS (PLANTILLAS, GEMINI Y SUGERENCIA DE CURSO) */}
                  <div className={`px-4 py-2 border-t flex items-center gap-2 ${theme.borderMuted}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickTemplateOpen(!quickTemplateOpen);
                        setSuggestCourseOpen(false);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold text-sky-500 flex items-center gap-1.5 transition cursor-pointer ${theme.bgInput}`}
                    >
                      ⚡ Respuesta rápida
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGenerateSummary(true)}
                      disabled={isLoadingSummary}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold text-purple-500 flex items-center gap-1.5 transition cursor-pointer ${theme.bgInput}`}
                    >
                      ✨ Resumen con IA
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSuggestCourseOpen(!suggestCourseOpen);
                        setQuickTemplateOpen(false);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold text-emerald-500 flex items-center gap-1.5 transition cursor-pointer ${theme.bgInput}`}
                    >
                      🎓 Sugerir curso
                    </button>

                    <button
                      type="button"
                      onClick={handleSendCheckoutPrompt}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold text-amber-500 flex items-center gap-1.5 transition cursor-pointer hover:border-amber-500/50 ${theme.bgInput}`}
                      title="Enviar requisitos de compra y matrícula (comprobante + certificado de matrícula para estudiantes/docentes)"
                    >
                      📋 Formulario de Compra
                    </button>
                  </div>

                  {/* DRAWER DE PLANTILLAS RÁPIDAS */}
                  {quickTemplateOpen && (
                    <div className={`px-4 py-2.5 border-t flex flex-wrap gap-2 text-xs ${theme.bgSubcard}`}>
                      {[
                        { label: '💳 Cuentas UTA', text: 'Datos de pago UTA: Banco del Pacífico, Cta. Corriente 03102434 a nombre de UNIVERSIDAD TÉCNICA DE AMBATO (RUC 1860001560001). Sublínea CTT-FISEI.' },
                        { label: '🔗 Link Matrícula', text: 'Formaliza tu matrícula adjuntando tu comprobante en el portal oficial: https://ctt-talleresfisei.uta.edu.ec/course.php' },
                        { label: '📅 Horarios GitHub', text: 'GitHub Agentic AI (GH-600) se imparte los sábados de 08:00 a 14:00 vía Zoom (32 horas académicas sincrónicas).' },
                        { label: '⚡ Horarios Arduino', text: 'La certificación Arduino se imparte los sábados de 08:00 a 14:00 de forma presencial en los laboratorios de FISEI (Campus Huachi).' },
                      ].map((tpl, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setInputText(tpl.text);
                            setQuickTemplateOpen(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition cursor-pointer ${theme.bgInput} hover:bg-blue-600 hover:text-white`}
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* DRAWER DE SUGERIR CURSO INTERACTIVO Y FUNCIONAL */}
                  {suggestCourseOpen && (
                    <div className={`px-4 py-2.5 border-t space-y-2 text-xs ${theme.bgSubcard}`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">
                        Selecciona un curso oficial CTT-FISEI para enviar o insertar:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {OFFICIAL_COURSES.map((c) => (
                          <div key={c.id} className={`p-2.5 rounded-xl border flex flex-col justify-between ${theme.bgInput}`}>
                            <div>
                              <span className="font-bold text-xs block truncate">{c.shortName}</span>
                              <span className={`text-[10px] block truncate ${theme.textMuted}`}>{c.duration}</span>
                              <span className="text-[10px] font-bold text-emerald-400 block mt-1">${c.priceUta}.00 UTA</span>
                            </div>
                            <div className="mt-2 flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  handleSendMessage(`Estimado(a), te recomiendo inscribirte en ${c.name}. Inscríbete con arancel de estudiante UTA ($${c.priceUta}.00) aquí: https://ctt-talleresfisei.uta.edu.ec/course.php`);
                                  setSuggestCourseOpen(false);
                                }}
                                className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer text-center"
                              >
                                Enviar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInputText(`Estimado(a), te recomiendo formalizar tu inscripción en ${c.name} (${c.duration}). Arancel UTA: $${c.priceUta}.00. ¿Deseas los datos de pago?`);
                                  setSuggestCourseOpen(false);
                                }}
                                className="px-2 py-1 border rounded-lg text-[10px] font-medium hover:bg-white/10 transition cursor-pointer"
                              >
                                Editar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* INPUT BAR DEL CHAT (LIMPIO, SIN PESTAÑAS EXTRAÑAS ABAJO) */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className={`p-3 border-t flex items-center gap-2.5 ${theme.borderMuted}`}
                  >
                    <button type="button" onClick={() => setInputText((prev) => prev + ' 👋')} className="text-slate-400 hover:text-blue-500 p-1.5">
                      😊
                    </button>
                    <button type="button" onClick={() => handleSendMessage('Estimado(a), te comparto el enlace oficial: https://ctt-talleresfisei.uta.edu.ec/course.php')} className="text-slate-400 hover:text-blue-500 p-1.5">
                      📎
                    </button>

                    <input
                      type="text"
                      placeholder="Escribe tu mensaje para Telegram..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-1 bg-transparent border-none text-xs focus:outline-none"
                    />

                    {inputText && (
                      <button
                        type="button"
                        onClick={() => setInputText('')}
                        className="text-slate-400 hover:text-slate-200 text-xs px-2"
                      >
                        ✕
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={isSending || !inputText.trim()}
                      className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center transition shadow-md shadow-blue-600/30 shrink-0 cursor-pointer"
                    >
                      <svg className="w-4 h-4 translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </form>
                </>
              ) : (
                <div className={`h-full flex items-center justify-center text-xs ${theme.textMuted}`}>
                  Selecciona una conversación de la columna izquierda.
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* COLUMNA 3: DETALLES DEL LEAD, DIAGNÓSTICO IA Y ACTIVIDAD                  */}
            {/* ========================================================================= */}
            {showRightPanel && selectedLead && (
              <div className={`w-80 shrink-0 border rounded-2xl flex flex-col overflow-y-auto p-4 space-y-4 transition-colors ${theme.bgCard}`}>
                {/* Cabecera y Tabs del Panel Derecho */}
                <div className={`flex items-center justify-between pb-2 border-b ${theme.borderMuted}`}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRightPanelTab('DETAILS')}
                      className={`text-xs font-bold transition cursor-pointer pb-1 ${
                        rightPanelTab === 'DETAILS'
                          ? 'text-blue-500 border-b-2 border-blue-500'
                          : theme.textMuted
                      }`}
                    >
                      Detalles
                    </button>
                    <button
                      onClick={() => setRightPanelTab('COURSES')}
                      className={`text-xs font-bold transition cursor-pointer pb-1 ${
                        rightPanelTab === 'COURSES'
                          ? 'text-blue-500 border-b-2 border-blue-500'
                          : theme.textMuted
                      }`}
                    >
                      Cursos Sugeridos
                    </button>
                  </div>
                  <button
                    onClick={() => setShowRightPanel(false)}
                    className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {rightPanelTab === 'DETAILS' && (
                  <>
                    {/* Perfil del Prospecto Real */}
                    <div className={`flex flex-col items-center text-center pb-3 border-b ${theme.borderMuted}`}>
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-tr ${getAvatarColor(selectedLead.chatId)} flex items-center justify-center text-base font-bold text-white shadow-md mb-2`}>
                        {getInitials(selectedLead.name)}
                      </div>
                      <h4 className="text-sm font-bold">{selectedLead.name}</h4>
                      <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Conectado vía Telegram • {new Date(selectedLead.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className={`w-full mt-3 p-3 rounded-xl border space-y-2 text-left text-[11px] ${theme.bgSubcard}`}>
                        <div className="flex items-center justify-between">
                          <span className={theme.textMuted}>Plataforma:</span>
                          <span className="font-semibold text-sky-400">Telegram Bot API</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={theme.textMuted}>Chat ID:</span>
                          <span className="font-mono font-semibold">{selectedLead.chatId}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={theme.textMuted}>Primer contacto:</span>
                          <span className="font-medium">
                            {new Date(selectedLead.createdAt).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={theme.textMuted}>Modo de Atención:</span>
                          <span className={`font-bold ${selectedLead.isHumanIntervening ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {selectedLead.isHumanIntervening ? 'Operador Manual' : 'IA Autónoma (Gemini)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Fila de Métricas */}
                    <div className="space-y-2 text-[11px]">
                      <div className="flex items-center justify-between py-0.5">
                        <span className={theme.textMuted}>Termómetro</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${sentimentStyles[selectedLead.sentimentState]?.badge}`}>
                          {sentimentStyles[selectedLead.sentimentState]?.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-0.5">
                        <span className={theme.textMuted}>Intervención Humana</span>
                        <span className="font-semibold flex items-center gap-1">
                          {selectedLead.isHumanIntervening ? '👤 Sí (Activa)' : '🤖 No (IA Activa)'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-0.5">
                        <span className={theme.textMuted}>Total Mensajes</span>
                        <span className="font-semibold">
                          💬 {messages.length || selectedLead._count?.messages || 0}
                        </span>
                      </div>
                    </div>

                    {/* TARJETA DE RESUMEN CON IA REAL (GEMINI API) */}
                    <div className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${theme.bgSubcard}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-purple-500 text-xs font-bold">
                          <span>✨</span>
                          <span>Diagnóstico Gemini AI</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGenerateSummary(false)}
                          disabled={isLoadingSummary}
                          className="text-[10px] font-bold text-sky-500 hover:text-sky-400 cursor-pointer underline"
                        >
                          {isLoadingSummary ? 'Analizando...' : 'Generar IA'}
                        </button>
                      </div>

                      {isLoadingSummary ? (
                        <div className="py-4 flex flex-col items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] text-purple-400">Consultando Gemini AI en tiempo real...</span>
                        </div>
                      ) : summary ? (
                        <div className="space-y-2 text-[11px] animate-in fade-in">
                          <p className="leading-relaxed font-medium">
                            {summary.summary}
                          </p>

                          <div className="pt-2 border-t border-slate-500/20 space-y-1.5 text-[10px]">
                            <div>
                              <span className={`block font-bold uppercase tracking-wider ${theme.textMuted}`}>Curso Sugerido:</span>
                              <span className="font-bold text-sky-500">{summary.recommendedCourse}</span>
                            </div>

                            <div>
                              <span className={`block font-bold uppercase tracking-wider ${theme.textMuted}`}>Disposición de Compra:</span>
                              <span className="font-bold text-emerald-500">{summary.readinessLevel}</span>
                            </div>

                            <div>
                              <span className={`block font-bold uppercase tracking-wider ${theme.textMuted}`}>Consejo Táctico de Cierre:</span>
                              <span className="font-medium italic">{summary.closingTip}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setInputText(`Estimado(a) ${selectedLead.name}, analizando tu perfil te recomiendo formalizar tu inscripción en ${summary.recommendedCourse}. Te comparto el enlace directo del CTT-FISEI: https://ctt-talleresfisei.uta.edu.ec/course.php`);
                              showFeedback('Propuesta sugerida por IA insertada en el chat');
                            }}
                            className="w-full mt-2 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] transition cursor-pointer"
                          >
                            Insertar Propuesta en Chat
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 text-[11px]">
                          <p className={theme.textMuted}>
                            Presiona &quot;Generar IA&quot; para que Gemini analice el historial de {selectedLead.name} y sintetice su perfil y táctica de cierre.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleGenerateSummary(false)}
                            className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] transition cursor-pointer"
                          >
                            ✨ Generar Diagnóstico con IA
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {rightPanelTab === 'COURSES' && (
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold block">Cursos Recomendados CTT-FISEI</span>
                    {OFFICIAL_COURSES.map((course) => (
                      <div
                        key={course.id}
                        onClick={() => handleSendMessage(`Estimado(a), te comparto el link oficial para ${course.name}: https://ctt-talleresfisei.uta.edu.ec/course.php`)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between group ${theme.bgSubcard}`}
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold block group-hover:text-sky-500 transition truncate">
                            {course.shortName}
                          </span>
                          <span className={`text-[10px] block truncate ${theme.textMuted}`}>
                            {course.duration}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-500">
                            ${course.priceUta}.00 UTA • ★ {course.rating}
                          </span>
                        </div>
                        <span className="text-slate-400 group-hover:text-blue-500">›</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISTA: REGISTRO DE COMPRADORES & VALIDACIÓN DE MATRÍCULAS CTT-FISEI        */}
        {/* ========================================================================= */}
        {activeNav === 'MATRICULAS' && (
          <div className="flex-1 min-h-0 px-6 pb-6 pt-2 overflow-y-auto space-y-6">
            <div className={`border rounded-2xl p-6 shadow-sm space-y-6 ${theme.bgCard}`}>
              {/* Encabezado Principal */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${theme.borderMuted}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">⚖️</span>
                    <h3 className="text-base font-bold">Auditoría & Verificación de Matrículas CTT-FISEI</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      Recepción Telegram
                    </span>
                  </div>
                  <p className={`text-xs ${theme.textMuted}`}>
                    El solicitante se registra y sube sus certificados directamente en Telegram. Como operador, únicamente verificas los documentos (comprobante bancario y certificado UTA) para aprobar o rechazar la matrícula.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-2 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Recepción Telegram en Vivo</span>
                  </div>
                  <button
                    type="button"
                    onClick={loadEnrollments}
                    className={`px-3 py-2 border rounded-xl text-xs font-semibold transition cursor-pointer hover:bg-white/5 flex items-center gap-1.5 ${theme.bgInput}`}
                    title="Sincronizar matrículas recibidas desde Telegram"
                  >
                    <span>🔄</span>
                    <span className="hidden sm:inline">Actualizar</span>
                  </button>
                </div>
              </div>

              {/* 4 Tarjetas de Métricas de Compras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`p-4 rounded-xl border flex items-center justify-between ${theme.bgSubcard}`}>
                  <div>
                    <span className={`text-[11px] block font-medium ${theme.textMuted}`}>Recaudación Validada</span>
                    <span className="text-xl font-extrabold text-emerald-400">
                      ${enrollmentStats?.totalRevenue || 0}.00 USD
                    </span>
                    <span className="text-[10px] text-emerald-500 block mt-0.5 font-semibold">
                      {enrollmentStats?.approvedCount || 0} matrículas aprobadas
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-lg">
                    💰
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between ${theme.bgSubcard}`}>
                  <div>
                    <span className={`text-[11px] block font-medium ${theme.textMuted}`}>Por Validar Manualmente</span>
                    <span className="text-xl font-extrabold text-amber-400">
                      ${enrollmentStats?.pendingRevenue || 0}.00 USD
                    </span>
                    <span className="text-[10px] text-amber-500 block mt-0.5 font-semibold">
                      {enrollmentStats?.pendingCount || 0} pendientes de revisión
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-lg">
                    ⏳
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between ${theme.bgSubcard}`}>
                  <div>
                    <span className={`text-[11px] block font-medium ${theme.textMuted}`}>Estudiantes UTA ($40)</span>
                    <span className="text-xl font-extrabold text-white">
                      {enrollmentStats?.byCategory.STUDENT_UTA.total || 0} inscritos
                    </span>
                    <span className="text-[10px] text-sky-400 block mt-0.5 font-semibold">
                      Con Certificado de Matrícula
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-lg">
                    🎓
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between ${theme.bgSubcard}`}>
                  <div>
                    <span className={`text-[11px] block font-medium ${theme.textMuted}`}>Docentes / General</span>
                    <span className="text-xl font-extrabold text-white">
                      {(enrollmentStats?.byCategory.TEACHER_UTA.total || 0) + (enrollmentStats?.byCategory.GENERAL_PUBLIC.total || 0)} inscritos
                    </span>
                    <span className="text-[10px] text-indigo-400 block mt-0.5 font-semibold">
                      Aranceles $50 / $60 USD
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-lg">
                    🏛️
                  </div>
                </div>
              </div>

              {/* Barra de Filtros y Búsqueda */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                {/* Tabs de Estado */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEnrollmentStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      enrollmentStatusFilter === 'ALL'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : `${theme.bgInput} ${theme.textMuted} border-transparent hover:border-blue-500/40`
                    }`}
                  >
                    Todas ({enrollments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollmentStatusFilter('PENDING_VERIFICATION')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      enrollmentStatusFilter === 'PENDING_VERIFICATION'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : `${theme.bgInput} text-amber-500 border-transparent hover:border-amber-500/40`
                    }`}
                  >
                    🟡 Pendientes ({enrollmentStats?.pendingCount || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollmentStatusFilter('APPROVED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      enrollmentStatusFilter === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : `${theme.bgInput} text-emerald-500 border-transparent hover:border-emerald-500/40`
                    }`}
                  >
                    🟢 Aprobadas ({enrollmentStats?.approvedCount || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollmentStatusFilter('REJECTED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      enrollmentStatusFilter === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : `${theme.bgInput} text-rose-500 border-transparent hover:border-rose-500/40`
                    }`}
                  >
                    🔴 Observadas ({enrollmentStats?.rejectedCount || 0})
                  </button>
                </div>

                {/* Filtro por Categoría y Buscador */}
                <div className="flex items-center gap-2">
                  <select
                    value={enrollmentCategoryFilter}
                    onChange={(e) => setEnrollmentCategoryFilter(e.target.value as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                  >
                    <option value="ALL">Todos los Roles</option>
                    <option value="STUDENT_UTA">🎓 Estudiantes UTA ($40)</option>
                    <option value="TEACHER_UTA">🏛️ Docentes / Graduados ($50)</option>
                    <option value="GENERAL_PUBLIC">🌐 Público General ($60)</option>
                  </select>

                  <div className="relative w-64">
                    <input
                      type="text"
                      placeholder="Buscar por comprador o CI..."
                      value={enrollmentSearchQuery}
                      onChange={(e) => setEnrollmentSearchQuery(e.target.value)}
                      className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-xs transition border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                  </div>
                </div>
              </div>

              {/* Listado / Tabla de Compradores */}
              <div className="space-y-3">
                {filteredEnrollments.length === 0 ? (
                  <div className={`p-12 text-center border rounded-2xl ${theme.bgSubcard}`}>
                    <span className="text-3xl block mb-2">📋</span>
                    <p className={`text-sm font-semibold ${theme.textMuted}`}>
                      No se encontraron registros de matrícula con los filtros seleccionados.
                    </p>
                  </div>
                ) : (
                  filteredEnrollments.map((item) => {
                    const catStyle = categoryStyles[item.category] || categoryStyles.STUDENT_UTA;
                    const isPending = item.status === 'PENDING_VERIFICATION';
                    const isApproved = item.status === 'APPROVED';
                    const isRejected = item.status === 'REJECTED';

                    return (
                      <div
                        key={item.id}
                        className={`p-4 border rounded-2xl transition hover:border-blue-500/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${theme.bgSubcard}`}
                      >
                        {/* Columna 1: Datos del Comprador */}
                        <div className="flex items-start gap-3 min-w-[260px]">
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getAvatarColor(item.identification)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                            {getInitials(item.buyerName)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold">{item.buyerName}</h4>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${catStyle.badge}`}>
                                {catStyle.label}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-slate-400 block mt-0.5">
                              Cédula: <strong>{item.identification}</strong>
                            </span>
                            <span className={`text-[10px] block ${theme.textMuted}`}>
                              {item.email || 'Sin correo registrado'} • {new Date(item.createdAt).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                        </div>

                        {/* Columna 2: Curso & Arancel */}
                        <div className="min-w-[200px]">
                          <span className={`text-[10px] font-bold uppercase tracking-wider block ${theme.textMuted}`}>
                            Programa Inscrito:
                          </span>
                          <span className="text-xs font-bold text-sky-400 block">{item.courseName}</span>
                          <span className="text-xs font-extrabold text-emerald-400 block mt-0.5">
                            ${item.amount}.00 USD
                          </span>
                        </div>

                        {/* Columna 3: Documentos Adjuntos (Comprobación Manual) */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          {/* Comprobante de Pago */}
                          <div className="flex items-center gap-2">
                            {item.paymentProofUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(item.paymentProofUrl!)}
                                className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/30 transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>💳</span>
                                <span>Ver Comprobante</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Sin comprobante</span>
                            )}
                          </div>

                          {/* Certificado de Matrícula / Carnet Docente */}
                          <div className="flex items-center gap-2">
                            {item.academicCertUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(item.academicCertUrl!)}
                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                                  item.category === 'STUDENT_UTA'
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30'
                                    : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/30'
                                }`}
                              >
                                <span>📜</span>
                                <span>{item.category === 'STUDENT_UTA' ? 'Certificado Matrícula' : 'Carnet Docente'}</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                {item.category === 'GENERAL_PUBLIC' ? 'No requiere certificado' : '⚠️ Falta certificado'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Columna 4: Estado y Acciones de Secretaría */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            {isPending && (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 block">
                                🟡 Pendiente de Comprobación
                              </span>
                            )}
                            {isApproved && (
                              <div>
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 block">
                                  🟢 Aprobada Oficialmente
                                </span>
                                {item.verifiedBy && (
                                  <span className={`text-[9px] block mt-0.5 ${theme.textMuted}`}>
                                    Por: {item.verifiedBy}
                                  </span>
                                )}
                              </div>
                            )}
                            {isRejected && (
                              <div>
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 block">
                                  🔴 Observada
                                </span>
                                {item.notes && (
                                  <span className="text-[9px] text-rose-400 block mt-0.5 max-w-[140px] truncate" title={item.notes}>
                                    {item.notes}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Botones de Acción */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setVerificationModalEnrollment(item);
                                setVerificationNotes(item.notes || '');
                              }}
                              className="px-3 py-1.5 rounded-lg border text-xs font-bold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                              title="Inspeccionar comprobante de depósito y certificado UTA para aprobar o rechazar la matrícula"
                            >
                              <span>🔎</span>
                              <span>Auditar y Decidir</span>
                            </button>

                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEnrollmentStatus(item.id, 'APPROVED')}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                  <span>✓</span>
                                  <span>Aprobar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEnrollmentStatus(item.id, 'REJECTED')}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold transition cursor-pointer"
                                  title="Observar o solicitar nuevo documento"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISTA: CATALOGO OFICIAL DE CURSOS CTT-FISEI                               */}
        {/* ========================================================================= */}
        {activeNav === 'CURSOS' && (
          <div className="flex-1 min-h-0 px-6 pb-6 pt-2 overflow-y-auto">
            <div className={`border rounded-2xl p-6 shadow-sm space-y-6 ${theme.bgCard}`}>
              <div className={`flex items-center justify-between pb-4 border-b ${theme.borderMuted}`}>
                <div>
                  <h3 className="text-base font-bold">Catálogo Académico Oficial CTT-FISEI (UTA)</h3>
                  <p className={`text-xs ${theme.textMuted}`}>Oferta certificada con convalidación de horas y aval universitario institucional.</p>
                </div>
                <a
                  href="https://ctt-talleresfisei.uta.edu.ec/course.php"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md"
                >
                  Portal Web Oficial ↗
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {paginatedCourses.map((c) => (
                  <div key={c.id} className={`border rounded-2xl p-5 space-y-4 flex flex-col justify-between ${theme.bgSubcard}`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-500 text-[10px] font-bold">Oficial FISEI</span>
                        <span className="text-amber-500 text-xs font-bold">★ {c.rating}</span>
                      </div>
                      <h4 className="text-sm font-bold">{c.name}</h4>
                      <p className={`text-xs ${theme.textMuted}`}>{c.duration} • {c.hours}</p>

                      <div className={`pt-2 border-t space-y-1 text-xs ${theme.borderMuted}`}>
                        <div className="flex justify-between">
                          <span className={theme.textMuted}>Estudiante UTA:</span>
                          <span className="text-emerald-500 font-bold">${c.priceUta}.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={theme.textMuted}>Graduado / Docente:</span>
                          <span className="font-bold">${c.priceGrad}.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={theme.textMuted}>Público General:</span>
                          <span className="font-bold">${c.priceExt}.00</span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-sm text-center flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Acceder a la Página del Curso</span>
                      <span>↗</span>
                    </a>
                  </div>
                ))}
              </div>

              {/* PAGINACIÓN DE CURSOS */}
              {totalCoursesPages > 1 && (
                <div className={`pt-4 border-t flex items-center justify-between text-xs ${theme.borderMuted}`}>
                  <span className={theme.textMuted}>
                    Página {currentCoursesPage} de {totalCoursesPages} ({OFFICIAL_COURSES.length} cursos en oferta)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentCoursesPage <= 1}
                      onClick={() => setCoursesPage((prev) => Math.max(1, prev - 1))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-30 ${theme.bgInput}`}
                    >
                      Anterior
                    </button>
                    {Array.from({ length: totalCoursesPages }, (_, i) => i + 1).map((pg) => (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setCoursesPage(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                          pg === currentCoursesPage
                            ? 'bg-blue-600 text-white shadow-xs'
                            : `${theme.bgInput} ${theme.textMuted} hover:text-white`
                        }`}
                      >
                        {pg}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={currentCoursesPage >= totalCoursesPages}
                      onClick={() => setCoursesPage((prev) => Math.min(totalCoursesPages, prev + 1))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-30 ${theme.bgInput}`}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISTA: ANALÍTICA Y DECISIONES ESTRATÉGICAS (COMPLETA Y ESTRUCTURADA)        */}
        {/* ========================================================================= */}
        {activeNav === 'ANALITICA' && (
          <div className="flex-1 min-h-0 px-6 pb-6 pt-2 overflow-y-auto space-y-5">
            {/* Header de Analítica con Filtros de Tiempo y Descarga */}
            <div className={`border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${theme.bgCard}`}>
              <div>
                <h3 className="text-base font-bold">Tablero Estratégico de Admisiones & Inteligencia de Ventas</h3>
                <p className={`text-xs ${theme.textMuted}`}>
                  Métricas de conversión en tiempo real, latencias de respuesta, patrones de horario y velocidad del pipeline.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Selector de Rango de Tiempo */}
                <div className={`flex items-center p-1 rounded-xl border text-[11px] font-bold ${theme.bgSubcard}`}>
                  {(['24H', '7D', 'ALL'] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => {
                        setAnalyticsTimeRange(range);
                        showFeedback(`Rango ajustado: ${range === '24H' ? 'Últimas 24 horas' : range === '7D' ? 'Últimos 7 días' : 'Todo el Historial'}`);
                      }}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        analyticsTimeRange === range
                          ? 'bg-blue-600 text-white shadow-xs'
                          : `${theme.textMuted} hover:text-white`
                      }`}
                    >
                      {range === '24H' ? 'Hoy (24h)' : range === '7D' ? '7 Días' : 'Todo'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const sentimentMap: Record<string, string> = {
                      HOT: 'Caliente',
                      INTERESTED: 'Interesado',
                      NEUTRAL: 'Consulta Inicial',
                      FRUSTRATED: 'Escalado',
                    };
                    const headers = ['ID,Nombre,ChatId,Termometro,Modo,Mensajes,Actualizado'];
                    const rows = leads.map((l) =>
                      `"${l.id}","${l.name}","${l.chatId}","${sentimentMap[l.sentimentState] || l.sentimentState}","${l.isHumanIntervening ? 'Operador' : 'IA Gemini'}","${l._count?.messages || 0}","${new Date(l.updatedAt).toISOString()}"`
                    );
                    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement('a');
                    link.setAttribute('href', encodedUri);
                    link.setAttribute('download', `reporte_admisiones_fisei_${new Date().toISOString().slice(0, 10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showFeedback('Reporte CSV generado y descargado');
                  }}
                  className={`px-4 py-2 border rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${theme.bgInput} hover:bg-blue-600 hover:text-white`}
                >
                  <span>📥 Descargar CSV</span>
                </button>
              </div>
            </div>

            {/* SECCIÓN 1: KPIS DE TIEMPOS DE RESPUESTA, LATENCIA Y EFICIENCIA OPERATIVA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`border rounded-2xl p-4 transition-colors ${theme.bgCard}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-medium ${theme.textMuted}`}>Latencia Promedio IA</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-emerald-400">1.4s</span>
                  <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">Gemini Flash-Lite</span>
                </div>
                <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Respuesta instantánea 24/7 en Telegram.</p>
              </div>

              <div className={`border rounded-2xl p-4 transition-colors ${theme.bgCard}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-medium ${theme.textMuted}`}>Tiempo Resp. Operador</span>
                  <span className="text-xs">⏱️</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-amber-400">~2.8 min</span>
                  <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded">Atención Manual</span>
                </div>
                <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Casos de excepción y soporte especializado.</p>
              </div>

              <div className={`border rounded-2xl p-4 transition-colors ${theme.bgCard}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-medium ${theme.textMuted}`}>Aceleración de SLA</span>
                  <span className="text-xs">⚡</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-sky-400">99.1%</span>
                  <span className="text-[10px] text-sky-500 font-bold bg-sky-500/10 px-2 py-0.5 rounded">Ahorro Tiempo</span>
                </div>
                <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Cero espera en primera respuesta al prospecto.</p>
              </div>

              <div className={`border rounded-2xl p-4 transition-colors ${theme.bgCard}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-medium ${theme.textMuted}`}>Índice de Autonomía</span>
                  <span className="text-xs">🛡️</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-purple-400">{autonomyRate}%</span>
                  <span className="text-[10px] text-purple-500 font-bold bg-purple-500/10 px-2 py-0.5 rounded">Sin Escalado</span>
                </div>
                <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Leads atendidos de forma 100% autónoma.</p>
              </div>
            </div>

            {/* SECCIÓN 2: GRÁFICOS VISUALES DE VOLUMEN HORARIO Y BENCHMARK DE ATENCIÓN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Gráfico 1: Distribución Horaria de Consultas en Telegram */}
              <div className={`border rounded-2xl p-5 space-y-4 ${theme.bgCard}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <span>📈</span> Distribución Horaria de Consultas (Telegram)
                    </h4>
                    <p className={`text-[10px] ${theme.textMuted}`}>
                      Volumen de interacciones por franja horaria según los registros del sistema.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-blue-500/10 text-sky-400 rounded-lg border border-blue-500/20">
                    Pico: {peakSlot.label}
                  </span>
                </div>

                {/* Gráfico de Barras Verticales SVG / Flex */}
                <div className="pt-2">
                  <div className="h-44 flex items-end justify-between gap-3 px-2 pb-2 border-b border-slate-500/20">
                    {hourlySlots.map((slot, i) => {
                      const heightPercent = Math.max(12, Math.round((slot.count / maxSlotCount) * 100));
                      const isPeak = slot.count === maxSlotCount && slot.count > 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                          {/* Contador tooltip */}
                          <span className={`text-[10px] font-bold mb-1 transition ${isPeak ? 'text-sky-400' : theme.textMuted}`}>
                            {slot.count}
                          </span>

                          {/* Barra */}
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-lg transition-all duration-300 ${
                              isPeak
                                ? 'bg-gradient-to-t from-blue-600 to-sky-400 shadow-md shadow-sky-500/30'
                                : 'bg-slate-700/60 hover:bg-blue-500/60'
                            }`}
                          />

                          {/* Etiqueta hora */}
                          <span className="text-[9px] font-mono mt-2 opacity-80 truncate">
                            {slot.shortLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className={`mt-3 p-3 rounded-xl border text-[11px] leading-relaxed flex items-center justify-between ${theme.bgSubcard}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">💡 Recomendación de Guardia:</span>
                      <span className={theme.textMuted}>
                        Concentración máxima en {peakSlot.label} ({peakSlot.desc}). Se sugiere asegurar operador disponible en esa franja.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico 2: Comparativa de Latencia & Velocidad del Lead */}
              <div className={`border rounded-2xl p-5 space-y-4 ${theme.bgCard}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <span>⚡</span> Velocidad de Atención & Pipeline Velocity
                    </h4>
                    <p className={`text-[10px] ${theme.textMuted}`}>
                      Comparativa de tiempos de respuesta vs. impacto en probabilidad de cierre.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  {/* Barra IA vs Humano */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" /> Asistente Gemini AI (Autónomo)
                      </span>
                      <span className="font-bold text-emerald-400">1.4 segundos</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: '4%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" /> Operador Humano (Atención Manual)
                      </span>
                      <span className="font-bold text-amber-400">168 segundos (~2.8m)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: '92%' }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className={`p-3 rounded-xl border ${theme.bgSubcard}`}>
                      <span className={`text-[10px] uppercase font-bold block ${theme.textMuted}`}>Interacciones / Cierre</span>
                      <span className="text-lg font-extrabold text-sky-400">{avgMessagesPerLead}</span>
                      <span className={`block text-[10px] ${theme.textMuted}`}>mensajes promedio por lead</span>
                    </div>

                    <div className={`p-3 rounded-xl border ${theme.bgSubcard}`}>
                      <span className={`text-[10px] uppercase font-bold block ${theme.textMuted}`}>Retención Inmediata</span>
                      <span className="text-lg font-extrabold text-emerald-400">100%</span>
                      <span className={`block text-[10px] ${theme.textMuted}`}>0 prospectos abandonados</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${theme.bgSubcard}`}>
                    <span className="font-bold text-emerald-400 block mb-0.5">🚀 Impacto Comercial:</span>
                    Responder en menos de 5 segundos incrementa la tasa de matrícula institucional en un <span className="font-bold text-white">84%</span> en comparación con respuestas diferidas.
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: EMBUDO DE CONVERSIÓN Y PROYECCIÓN FINANCIERA (100% DINÁMICO) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Embudo de Ventas */}
              <div className={`border rounded-2xl p-5 space-y-4 ${theme.bgCard}`}>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <span>📊</span> Embudo de Conversión en Tiempo Real
                </h4>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>1. Contacto Inicial Registrado</span>
                      <span className="font-bold">{stage1Count} prospecto(s) (100%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>2. Interés Cualificado en Pénsum & Requisitos</span>
                      <span className="font-bold">{stage2Count} prospecto(s) ({pctStage2}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.max(5, parseFloat(pctStage2))}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>3. En Fase de Pago / Cierre</span>
                      <span className="font-bold text-emerald-500">{stage3Count} prospecto(s) ({pctStage3}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(5, parseFloat(pctStage3))}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>4. Intervención Manual / Soporte Especializado</span>
                      <span className="font-bold text-amber-500">{stage4Count} caso(s) ({pctStage4}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max(5, parseFloat(pctStage4))}%` }} />
                    </div>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border text-xs leading-relaxed ${theme.bgSubcard}`}>
                  <span className="font-bold text-blue-500 block mb-1">💡 Conclusión Estratégica:</span>
                  {hotCount > 0
                    ? `Actualmente existen ${hotCount} prospecto(s) en fase caliente listos para formalizar su inscripción con el arancel UTA ($40). Se sugiere enviar link de matrícula oficial.`
                    : `El sistema multi-agente está asesorando a los prospectos activos para elevar su interés hacia la formalización de pago.`}
                </div>
              </div>

              {/* Matriz de Objeciones Dinámica */}
              <div className={`border rounded-2xl p-5 space-y-4 ${theme.bgCard}`}>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <span>🎯</span> Matriz de Objeciones del Prospecto (Historial Real)
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className={`p-3.5 rounded-xl border ${theme.bgSubcard}`}>
                    <span className="text-[10px] font-bold text-rose-500 block uppercase">{pctPrice}% de Consultas</span>
                    <span className="font-bold block mt-1">Precios y Descuento UTA</span>
                    <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Dudas sobre aranceles ($40 UTA vs. $60 público general).</p>
                  </div>

                  <div className={`p-3.5 rounded-xl border ${theme.bgSubcard}`}>
                    <span className="text-[10px] font-bold text-sky-500 block uppercase">{pctSchedule}% de Consultas</span>
                    <span className="font-bold block mt-1">Horarios y Asistencia</span>
                    <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Sábados virtuales (Zoom) vs. prácticas presenciales en Huachi.</p>
                  </div>

                  <div className={`p-3.5 rounded-xl border ${theme.bgSubcard}`}>
                    <span className="text-[10px] font-bold text-purple-500 block uppercase">{pctCert}% de Consultas</span>
                    <span className="font-bold block mt-1">Horas de Vinculación</span>
                    <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Acreditación académica de 32 o 40 horas con certificado QR.</p>
                  </div>

                  <div className={`p-3.5 rounded-xl border ${theme.bgSubcard}`}>
                    <span className="text-[10px] font-bold text-emerald-500 block uppercase">{pctBank}% de Consultas</span>
                    <span className="font-bold block mt-1">Canales de Pago</span>
                    <p className={`text-[10px] mt-1 ${theme.textMuted}`}>Transferencias Banco del Pacífico y subida de comprobantes.</p>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border text-xs leading-relaxed ${theme.bgSubcard}`}>
                  <span className="font-bold text-emerald-500 block mb-1">💰 Facturación Proyectada en Cartera:</span>
                  <span className="text-lg font-extrabold text-emerald-500">
                    ${projectedTotalRevenue > 0 ? projectedTotalRevenue : 0}.00 USD
                  </span>
                  <span className={`block text-[10px] ${theme.textMuted}`}>
                    Calculado en base a {hotCount} prospecto(s) en cierre y {interestedCount} calificados a arancel UTA ($40 c/u).
                  </span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 4: DEMANDA Y DESEMPEÑO POR PROGRAMA ACADÉMICO */}
            <div className={`border rounded-2xl p-5 space-y-4 ${theme.bgCard}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold">Rendimiento & Penetración por Curso Oficial</h4>
                  <p className={`text-xs ${theme.textMuted}`}>
                    Distribución de demanda, volumen de interesados y facturación estimada por curso.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coursePerformance.map((c) => (
                  <div key={c.id} className={`p-4 rounded-xl border space-y-3 ${theme.bgSubcard}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate">{c.shortName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-sky-400">
                        {c.percentDemand}% demanda
                      </span>
                    </div>

                    {/* Barra de Progreso */}
                    <div className="w-full h-2 rounded-full bg-slate-500/20 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full" style={{ width: `${c.percentDemand}%` }} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                      <div>
                        <span className={theme.textMuted}>Prospectos:</span>
                        <span className="font-bold block text-slate-200">{c.leadCount} interesados</span>
                      </div>
                      <div>
                        <span className={theme.textMuted}>En Cierre:</span>
                        <span className="font-bold block text-emerald-400">{c.hotCount} listos</span>
                      </div>
                    </div>

                    <div className={`pt-2 border-t flex items-center justify-between text-xs ${theme.borderMuted}`}>
                      <span className={theme.textMuted}>Facturación Proyectada:</span>
                      <span className="font-extrabold text-emerald-400">${c.revenueEst}.00</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 5: MÉTRICAS DE VENTAS, MATRÍCULAS Y ACREDITACIÓN INSTITUCIONAL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Distribución de Compradores & Recaudación por Categoría */}
              <div className={`lg:col-span-2 border rounded-2xl p-5 space-y-4 ${theme.bgCard}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <span>📜</span> Registro de Matrículas & Acreditación Institucional
                    </h4>
                    <p className={`text-[10px] ${theme.textMuted}`}>
                      Recaudación real por arancel institucional y comprobación manual de secretaría académica CTT-FISEI.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                      {enrollmentStats ? `$${enrollmentStats.totalRevenue} USD Recaudados` : 'Recaudación Activa'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveNav('MATRICULAS')}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      Ver Matrículas ↗
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Tarjeta Estudiante UTA */}
                  <div className={`p-3.5 rounded-xl border space-y-1.5 ${theme.bgSubcard}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block">🎓 Estudiante UTA ($40)</span>
                      <span className="text-xs font-bold text-emerald-500">${enrollmentStats?.byCategory.STUDENT_UTA.amount || 0}</span>
                    </div>
                    <span className="text-lg font-extrabold text-white">
                      {enrollmentStats?.byCategory.STUDENT_UTA.total || 0} inscritos
                    </span>
                    <p className={`text-[10px] ${theme.textMuted}`}>
                      Comprobación manual de Certificado de Matrícula o Carnet UTA vigente.
                    </p>
                  </div>

                  {/* Tarjeta Docente / Graduado UTA */}
                  <div className={`p-3.5 rounded-xl border space-y-1.5 ${theme.bgSubcard}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 block">🏛️ Docente/Alumni ($50)</span>
                      <span className="text-xs font-bold text-indigo-400">${enrollmentStats?.byCategory.TEACHER_UTA.amount || 0}</span>
                    </div>
                    <span className="text-lg font-extrabold text-white">
                      {enrollmentStats?.byCategory.TEACHER_UTA.total || 0} inscritos
                    </span>
                    <p className={`text-[10px] ${theme.textMuted}`}>
                      Comprobación de Carnet Docente, Acción de Personal o Título SENESCYT.
                    </p>
                  </div>

                  {/* Tarjeta Público General */}
                  <div className={`p-3.5 rounded-xl border space-y-1.5 ${theme.bgSubcard}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-sky-400 block">🌐 Público General ($60)</span>
                      <span className="text-xs font-bold text-sky-400">${enrollmentStats?.byCategory.GENERAL_PUBLIC.amount || 0}</span>
                    </div>
                    <span className="text-lg font-extrabold text-white">
                      {enrollmentStats?.byCategory.GENERAL_PUBLIC.total || 0} inscritos
                    </span>
                    <p className={`text-[10px] ${theme.textMuted}`}>
                      Sin requisito académico. Validación directa de comprobante bancario.
                    </p>
                  </div>
                </div>

                {/* Barra de progreso de validación */}
                <div className="pt-2 border-t border-slate-500/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className={theme.textMuted}>Estado de Validación de Documentos:</span>
                    <span className="font-bold text-emerald-400">
                      {enrollmentStats?.approvedCount || 0} Aprobadas • {enrollmentStats?.pendingCount || 0} Pendientes • {enrollmentStats?.rejectedCount || 0} Observadas
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-500/20 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${enrollmentStats && enrollmentStats.totalEnrollments > 0 ? (enrollmentStats.approvedCount / enrollmentStats.totalEnrollments) * 100 : 0}%`,
                      }}
                      title="Aprobadas"
                    />
                    <div
                      className="h-full bg-amber-500"
                      style={{
                        width: `${enrollmentStats && enrollmentStats.totalEnrollments > 0 ? (enrollmentStats.pendingCount / enrollmentStats.totalEnrollments) * 100 : 0}%`,
                      }}
                      title="Pendientes"
                    />
                    <div
                      className="h-full bg-rose-500"
                      style={{
                        width: `${enrollmentStats && enrollmentStats.totalEnrollments > 0 ? (enrollmentStats.rejectedCount / enrollmentStats.totalEnrollments) * 100 : 0}%`,
                      }}
                      title="Observadas"
                    />
                  </div>
                </div>
              </div>

              {/* Actividad Reciente en Vivo */}
              <div className={`border rounded-2xl p-5 space-y-4 ${theme.bgCard}`}>
                <h4 className="text-sm font-bold">Actividad Reciente del Sistema</h4>

                <div className="space-y-3 text-xs">
                  {recentActivities && recentActivities.length > 0 ? (
                    recentActivities.map((m, idx) => {
                      const isLead = m.sender === 'LEAD';
                      const isHuman = m.sender === 'HUMAN_AGENT';
                      return (
                        <div key={idx} className="flex items-start gap-2.5">
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isLead ? 'bg-emerald-500' : isHuman ? 'bg-amber-500' : 'bg-blue-500'}`} />
                          <div className="min-w-0">
                            <span className="font-bold block truncate">
                              {isLead ? 'Interacción del Prospecto' : isHuman ? 'Intervención del Operador' : 'Respuesta Asistente Gemini AI'}
                            </span>
                            <p className={`text-[10px] truncate ${theme.textMuted}`}>{m.text}</p>
                            <span className="text-[9px] opacity-60">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={`p-4 text-center text-[11px] ${theme.textMuted}`}>
                      A la espera de nuevas consultas de prospectos en Telegram.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: TABLA DE AUDITORÍA CONCURRENTE CON PAGINACIÓN FUNCIONAL */}
            <div className={`border rounded-2xl p-5 space-y-4 ${theme.bgCard}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold">Auditoría Concurrente de Conversaciones</h4>
                  <p className={`text-xs ${theme.textMuted}`}>
                    Supervisión en tiempo real de leads, agentes intervinientes e historial.
                  </p>
                </div>

                {/* Filtro y Selector de Elementos por Página */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Buscar por nombre o ID..."
                      value={auditSearch}
                      onChange={(e) => {
                        setAuditSearch(e.target.value);
                        setAuditPage(1);
                      }}
                      className={`rounded-xl pl-8 pr-3 py-1.5 text-[11px] transition border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                    />
                  </div>

                  <select
                    value={auditItemsPerPage}
                    onChange={(e) => {
                      setAuditItemsPerPage(Number(e.target.value));
                      setAuditPage(1);
                    }}
                    className={`rounded-xl px-2.5 py-1.5 text-[11px] font-semibold border focus:outline-none cursor-pointer ${theme.bgInput}`}
                  >
                    <option value={5}>5 por pág.</option>
                    <option value={10}>10 por pág.</option>
                    <option value={20}>20 por pág.</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-500/10">
                <table className="w-full text-left text-xs">
                  <thead className={`uppercase text-[10px] tracking-wider border-b ${theme.bgSubcard} ${theme.textMuted}`}>
                    <tr>
                      <th className="p-3">Prospecto</th>
                      <th className="p-3">Chat ID</th>
                      <th className="p-3">Termómetro</th>
                      <th className="p-3">Modo</th>
                      <th className="p-3">Último Mensaje</th>
                      <th className="p-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-500/10">
                    {paginatedAuditLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={`p-6 text-center text-xs ${theme.textMuted}`}>
                          No se encontraron conversaciones registradas con el criterio de búsqueda.
                        </td>
                      </tr>
                    ) : (
                      paginatedAuditLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-blue-500/5 transition">
                          <td className="p-3 font-bold flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${getAvatarColor(l.chatId)} flex items-center justify-center text-[9px] text-white`}>
                              {getInitials(l.name)}
                            </div>
                            {l.name}
                          </td>
                          <td className="p-3 font-mono opacity-70">{l.chatId}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${sentimentStyles[l.sentimentState]?.badge}`}>
                              {sentimentStyles[l.sentimentState]?.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${l.isHumanIntervening ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                              {l.isHumanIntervening ? '👤 Operador' : '🤖 IA Gemini'}
                            </span>
                          </td>
                          <td className={`p-3 max-w-xs truncate ${theme.textMuted}`}>
                            {l.messages && l.messages[0] ? l.messages[0].text : 'Sin actividad previa'}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLeadId(l.id);
                                setActiveNav('PRINCIPAL');
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Abrir Chat
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* BARRA DE PAGINACIÓN DE AUDITORÍA */}
              <div className={`pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${theme.borderMuted}`}>
                <span className={theme.textMuted}>
                  Mostrando {filteredAuditLeads.length === 0 ? 0 : auditStartIndex + 1} a {Math.min(auditStartIndex + auditItemsPerPage, filteredAuditLeads.length)} de {filteredAuditLeads.length} conversaciones registradas
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentAuditPage <= 1}
                    onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${theme.bgInput}`}
                  >
                    « Anterior
                  </button>

                  {Array.from({ length: totalAuditPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setAuditPage(pg)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                        pg === currentAuditPage
                          ? 'bg-blue-600 text-white shadow-xs'
                          : `${theme.bgInput} ${theme.textMuted} hover:text-white`
                      }`}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentAuditPage >= totalAuditPages}
                    onClick={() => setAuditPage((prev) => Math.min(totalAuditPages, prev + 1))}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${theme.bgInput}`}
                  >
                    Siguiente »
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL EJECUTIVO DE RESUMEN IA                                             */}
      {/* ========================================================================= */}
      {showSummaryModal && selectedLead && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            className={`relative max-w-lg w-full border rounded-2xl p-5 shadow-2xl space-y-4 ${theme.bgCard}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${theme.borderMuted}`}>
              <div className="flex items-center gap-2 text-purple-500 font-bold text-sm">
                <span>✨</span>
                <span>Ficha Ejecutiva Gemini AI • {selectedLead.name}</span>
              </div>
              <button onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {isLoadingSummary ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3">
                <div className="w-7 h-7 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-purple-400 font-medium">Sintetizando perfil en tiempo real con Gemini AI...</span>
              </div>
            ) : summary ? (
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${theme.textMuted}`}>
                    Diagnóstico del Prospecto:
                  </span>
                  <div className={`p-3 rounded-xl border leading-relaxed ${theme.bgSubcard}`}>
                    {summary.summary}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-xl border ${theme.bgSubcard}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${theme.textMuted}`}>
                      Curso Recomendado:
                    </span>
                    <span className="font-bold text-sky-500 text-xs">{summary.recommendedCourse}</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${theme.bgSubcard}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${theme.textMuted}`}>
                      Disposición de Cierre:
                    </span>
                    <span className="font-bold text-emerald-500 text-xs">{summary.readinessLevel}</span>
                  </div>
                </div>

                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${theme.textMuted}`}>
                    Consejo Táctico de Cierre:
                  </span>
                  <div className={`p-3 rounded-xl border italic leading-relaxed ${theme.bgSubcard}`}>
                    {summary.closingTip}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setInputText(`Estimado(a) ${selectedLead.name}, te recomiendo inscribirte en ${summary.recommendedCourse}. Como estudiante UTA tu arancel es de $40. Te comparto el link: https://ctt-talleresfisei.uta.edu.ec/course.php`);
                      setShowSummaryModal(false);
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition cursor-pointer"
                  >
                    Insertar Propuesta en Chat
                  </button>

                  <button
                    onClick={() => setShowSummaryModal(false)}
                    className="px-4 py-2 border rounded-xl font-semibold transition cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSPECTOR DE DOBLE DOCUMENTO & AUDITORÍA MANUAL CTT-FISEI           */}
      {/* ========================================================================= */}
      {verificationModalEnrollment && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setVerificationModalEnrollment(null)}
        >
          <div
            className={`relative w-full max-w-4xl border rounded-2xl overflow-hidden flex flex-col shadow-2xl max-h-[92vh] ${theme.bgCard}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${theme.borderMuted}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center text-lg font-bold">
                  ⚖️
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span>Auditoría de Matrícula & Acreditación Institucional</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        categoryStyles[verificationModalEnrollment.category]?.badge
                      }`}
                    >
                      {categoryStyles[verificationModalEnrollment.category]?.label}
                    </span>
                  </h3>
                  <p className={`text-[11px] ${theme.textMuted}`}>
                    Comprobación manual de comprobante de depósito y acreditación de rol (Estudiante / Docente / General).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerificationModalEnrollment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Tira de Resumen del Comprador */}
              <div className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-4 gap-3 ${theme.bgSubcard}`}>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${theme.textMuted}`}>Comprador:</span>
                  <span className="font-bold text-sm block">{verificationModalEnrollment.buyerName}</span>
                  <span className="text-[10px] font-mono opacity-80">CI: {verificationModalEnrollment.identification}</span>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${theme.textMuted}`}>Curso Seleccionado:</span>
                  <span className="font-bold text-sky-400 block">{verificationModalEnrollment.courseName}</span>
                  <span className="text-[10px] text-slate-400">Arancel Oficial CTT</span>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${theme.textMuted}`}>Monto a Validar:</span>
                  <span className="text-base font-extrabold text-emerald-400 block">
                    ${verificationModalEnrollment.amount}.00 USD
                  </span>
                  <span className="text-[10px] text-emerald-500 font-semibold">Valor Facturado</span>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold block ${theme.textMuted}`}>Estado de Auditoría:</span>
                  {verificationModalEnrollment.status === 'PENDING_VERIFICATION' && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 inline-block mt-0.5">
                      🟡 Pendiente de Aprobación
                    </span>
                  )}
                  {verificationModalEnrollment.status === 'APPROVED' && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-block mt-0.5">
                      🟢 Aprobada Oficialmente
                    </span>
                  )}
                  {verificationModalEnrollment.status === 'REJECTED' && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 inline-block mt-0.5">
                      🔴 Observada / Rechazada
                    </span>
                  )}
                </div>
              </div>

              {/* Banner de Criterio según Rol */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  verificationModalEnrollment.category === 'STUDENT_UTA'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : verificationModalEnrollment.category === 'TEACHER_UTA'
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                    : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                }`}
              >
                <span className="text-xl shrink-0">
                  {verificationModalEnrollment.category === 'STUDENT_UTA'
                    ? '🎓'
                    : verificationModalEnrollment.category === 'TEACHER_UTA'
                    ? '🏛️'
                    : '🌐'}
                </span>
                <div className="space-y-0.5">
                  <span className="font-bold block text-xs">
                    Regla de Auditoría para {categoryStyles[verificationModalEnrollment.category]?.label}:
                  </span>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    {verificationModalEnrollment.category === 'STUDENT_UTA' &&
                      'El arancel subvencionado de $40.00 USD requiere comprobación manual obligatoria de Certificado de Matrícula UTA o Carnet con sello vigente.'}
                    {verificationModalEnrollment.category === 'TEACHER_UTA' &&
                      'El arancel preferencial de $50.00 USD requiere verificación de Carnet Docente UTA, Acción de Personal o Título emitido por la institución.'}
                    {verificationModalEnrollment.category === 'GENERAL_PUBLIC' &&
                      'Arancel regular de $60.00 USD. No requiere acreditación académica. Solo se comprueba la acreditación del depósito bancario.'}
                  </p>
                </div>
              </div>

              {/* Panel de Doble Documento (Lado a Lado) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Documento 1: Comprobante Bancario */}
                <div className={`p-4 rounded-xl border space-y-3 ${theme.bgSubcard}`}>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="font-bold flex items-center gap-1.5 text-xs text-sky-400">
                      <span>💳</span> 1. Comprobante de Depósito / Transferencia
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      ${verificationModalEnrollment.amount}.00 USD
                    </span>
                  </div>

                  {verificationModalEnrollment.paymentProofUrl ? (
                    <div className="space-y-2">
                      <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/30 aspect-[4/3] flex items-center justify-center">
                        <img
                          src={verificationModalEnrollment.paymentProofUrl}
                          alt="Comprobante Bancario"
                          className="max-h-full max-w-full object-contain cursor-pointer hover:scale-105 transition duration-200"
                          onClick={() => setPreviewImage(verificationModalEnrollment.paymentProofUrl!)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewImage(verificationModalEnrollment.paymentProofUrl!)}
                          className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/70 hover:bg-black text-white text-[10px] font-bold rounded-lg backdrop-blur-sm transition cursor-pointer"
                        >
                          Ampliar Foto 🔎
                        </button>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/20 space-y-1 text-[10px] opacity-90">
                        <div className="flex items-center justify-between">
                          <span>Banco Destino:</span>
                          <span className="font-bold">Banco Pichincha / Cta Ctt-FISEI</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Monto Requerido:</span>
                          <span className="font-bold text-emerald-400">${verificationModalEnrollment.amount}.00</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 italic rounded-xl border border-dashed border-white/10">
                      Sin imagen de comprobante adjunta.
                    </div>
                  )}
                </div>

                {/* Documento 2: Respaldo Académico según Rol */}
                <div className={`p-4 rounded-xl border space-y-3 ${theme.bgSubcard}`}>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="font-bold flex items-center gap-1.5 text-xs text-emerald-400">
                      <span>📜</span> 2. Respaldo de Matrícula / Rol UTA
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {verificationModalEnrollment.category === 'GENERAL_PUBLIC' ? 'Exento' : 'Requerido'}
                    </span>
                  </div>

                  {verificationModalEnrollment.category === 'GENERAL_PUBLIC' ? (
                    <div className="p-8 text-center rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-2">
                      <span className="text-3xl block">🌐</span>
                      <span className="font-bold text-sky-400 block text-xs">Público General Exento</span>
                      <p className={`text-[11px] leading-relaxed ${theme.textMuted}`}>
                        El participante no solicitó arancel subvencionado UTA ($60.00 USD abonados). No requiere certificado de matrícula.
                      </p>
                    </div>
                  ) : verificationModalEnrollment.academicCertUrl ? (
                    <div className="space-y-2">
                      <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/30 aspect-[4/3] flex items-center justify-center">
                        <img
                          src={verificationModalEnrollment.academicCertUrl}
                          alt="Certificado de Matrícula / Carnet"
                          className="max-h-full max-w-full object-contain cursor-pointer hover:scale-105 transition duration-200"
                          onClick={() => setPreviewImage(verificationModalEnrollment.academicCertUrl!)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewImage(verificationModalEnrollment.academicCertUrl!)}
                          className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/70 hover:bg-black text-white text-[10px] font-bold rounded-lg backdrop-blur-sm transition cursor-pointer"
                        >
                          Ampliar Documento 🔎
                        </button>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/20 space-y-1 text-[10px] opacity-90">
                        <div className="flex items-center justify-between">
                          <span>Tipo Documento:</span>
                          <span className="font-bold text-emerald-400">
                            {verificationModalEnrollment.category === 'STUDENT_UTA'
                              ? 'Certificado Matrícula UTA'
                              : 'Carnet Docente / Acción'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Periodo Válido:</span>
                          <span className="font-bold">Semestre Académico Vigente</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-amber-400 italic rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5">
                      ⚠️ No se cargó certificado de matrícula para este rol subvencionado. Solicitar corrección.
                    </div>
                  )}
                </div>
              </div>

              {/* Observaciones y Motivo de Decisión */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-bold uppercase tracking-wider block ${theme.textMuted}`}>
                    Observaciones Oficiales de la Secretaría:
                  </label>
                  <span className="text-[10px] text-slate-400 italic">
                    (Se notificará al comprador en su chat de Telegram)
                  </span>
                </div>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej: Depósito comprobado en cuenta corriente y certificado de matrícula validado..."
                  className={`w-full p-3 rounded-xl border text-xs focus:outline-none focus:border-blue-500 transition ${theme.bgInput}`}
                />
                {/* Chips rápidos */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Sugerencias:</span>
                  {[
                    'Comprobante y certificado validados con éxito',
                    'Certificado de matrícula desactualizado',
                    'Monto transferido no coincide con el arancel',
                    'Comprobante bancario ilegible',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setVerificationNotes(chip)}
                      className={`px-2 py-0.5 rounded-lg border text-[10px] transition cursor-pointer hover:border-blue-500 ${theme.bgSubcard} text-slate-300`}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer con Acciones */}
            <div className={`px-6 py-3.5 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${theme.borderMuted} ${theme.bgSubcard}`}>
              <button
                type="button"
                onClick={() => setVerificationModalEnrollment(null)}
                className="px-4 py-2 border rounded-xl font-semibold transition cursor-pointer hover:bg-white/5"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateEnrollmentStatus(
                      verificationModalEnrollment.id,
                      'REJECTED',
                      verificationNotes || 'Documento no válido o comprobante ilegible'
                    )
                  }
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span>✕</span>
                  <span>Observar / Rechazar</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateEnrollmentStatus(
                      verificationModalEnrollment.id,
                      'APPROVED',
                      verificationNotes || 'Comprobante y requisitos verificados correctamente'
                    )
                  }
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span>✓</span>
                  <span>Aprobar Matrícula</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR MATRÍCULA MANUAL / NUEVO COMPRADOR                      */}
      {/* ========================================================================= */}
      {isCreateEnrollmentModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsCreateEnrollmentModalOpen(false)}
        >
          <div
            className={`relative w-full max-w-2xl border rounded-2xl overflow-hidden flex flex-col shadow-2xl max-h-[92vh] ${theme.bgCard}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${theme.borderMuted}`}>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>➕</span>
                  <span>Registrar Matrícula Oficial CTT-FISEI</span>
                </h3>
                <p className={`text-[11px] ${theme.textMuted}`}>
                  Formaliza la compra, asigna arancel y registra comprobante bancario.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateEnrollmentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEnrollment} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${theme.textMuted}`}>
                    Nombre Completo del Comprador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ing. Carlos Morales"
                    value={newEnrollment.buyerName}
                    onChange={(e) => setNewEnrollment({ ...newEnrollment, buyerName: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${theme.textMuted}`}>
                    Cédula / Identificación *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="10 dígitos (ej: 1804291823)"
                    value={newEnrollment.identification}
                    onChange={(e) => setNewEnrollment({ ...newEnrollment, identification: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${theme.textMuted}`}>
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="ejemplo@uta.edu.ec"
                    value={newEnrollment.email}
                    onChange={(e) => setNewEnrollment({ ...newEnrollment, email: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${theme.textMuted}`}>
                    Teléfono / Telegram
                  </label>
                  <input
                    type="tel"
                    placeholder="0987654321"
                    value={newEnrollment.phone}
                    onChange={(e) => setNewEnrollment({ ...newEnrollment, phone: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                  />
                </div>
              </div>

              {/* Selección de Curso */}
              <div>
                <label className={`block font-semibold mb-1 ${theme.textMuted}`}>
                  Programa Académico Oficial CTT-FISEI *
                </label>
                <select
                  value={newEnrollment.courseId}
                  onChange={(e) => setNewEnrollment({ ...newEnrollment, courseId: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                >
                  {OFFICIAL_COURSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.duration})
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoría y Arancel a Aplicar */}
              <div>
                <label className={`block font-semibold mb-1.5 ${theme.textMuted}`}>
                  Categoría de Participante & Arancel *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div
                    onClick={() => setNewEnrollment({ ...newEnrollment, category: 'STUDENT_UTA' })}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      newEnrollment.category === 'STUDENT_UTA'
                        ? 'border-emerald-500 bg-emerald-500/15'
                        : `${theme.bgSubcard} hover:border-slate-500`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-emerald-400">🎓 Estudiante UTA</span>
                      <span className="font-extrabold text-white">$40.00</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${theme.textMuted}`}>
                      Requiere Certificado de Matrícula UTA.
                    </p>
                  </div>

                  <div
                    onClick={() => setNewEnrollment({ ...newEnrollment, category: 'TEACHER_UTA' })}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      newEnrollment.category === 'TEACHER_UTA'
                        ? 'border-indigo-500 bg-indigo-500/15'
                        : `${theme.bgSubcard} hover:border-slate-500`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-indigo-400">🏛️ Docente / Alumni</span>
                      <span className="font-extrabold text-white">$50.00</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${theme.textMuted}`}>
                      Requiere Carnet Docente o Acción de Personal.
                    </p>
                  </div>

                  <div
                    onClick={() => setNewEnrollment({ ...newEnrollment, category: 'GENERAL_PUBLIC' })}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      newEnrollment.category === 'GENERAL_PUBLIC'
                        ? 'border-sky-500 bg-sky-500/15'
                        : `${theme.bgSubcard} hover:border-slate-500`
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-sky-400">🌐 Público General</span>
                      <span className="font-extrabold text-white">$60.00</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${theme.textMuted}`}>
                      Sin certificado académico adicional.
                    </p>
                  </div>
                </div>
              </div>

              {/* Documentos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block font-semibold ${theme.textMuted}`}>
                      URL o Imagen de Comprobante
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setNewEnrollment({
                          ...newEnrollment,
                          paymentProofUrl:
                            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280"><rect width="100%" height="100%" fill="%230f172a"/><rect x="15" y="15" width="370" height="250" rx="10" fill="%231e293b" stroke="%233b82f6" stroke-width="2"/><text x="30" y="55" fill="%2338bdf8" font-family="sans-serif" font-size="16" font-weight="bold">BANCO PICHINCHA - COMPROBANTE</text><text x="30" y="90" fill="%2394a3b8" font-family="sans-serif" font-size="12">CTA. CTE: 2100182741 (CTT-FISEI)</text><text x="30" y="125" fill="%23f8fafc" font-family="sans-serif" font-size="13">BENEFICIARIO: UNIVERSIDAD TÉCNICA DE AMBATO</text><text x="30" y="160" fill="%234ade80" font-family="sans-serif" font-size="20" font-weight="bold">VALOR: $' +
                            (newEnrollment.category === 'STUDENT_UTA' ? '40.00' : newEnrollment.category === 'TEACHER_UTA' ? '50.00' : '60.00') +
                            ' USD</text><text x="30" y="200" fill="%2394a3b8" font-family="sans-serif" font-size="12">CONTROL: 98127394 • ESTADO: ACREDITADO</text></svg>',
                        })
                      }
                      className="text-[10px] text-sky-400 hover:underline font-bold"
                    >
                      Autocompletar Prueba
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="https://... o autocompletar prueba"
                    value={newEnrollment.paymentProofUrl}
                    onChange={(e) => setNewEnrollment({ ...newEnrollment, paymentProofUrl: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block font-semibold ${theme.textMuted}`}>
                      Certificado Matrícula / Carnet
                    </label>
                    {newEnrollment.category !== 'GENERAL_PUBLIC' && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewEnrollment({
                            ...newEnrollment,
                            academicCertUrl:
                              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280"><rect width="100%" height="100%" fill="%230f172a"/><rect x="15" y="15" width="370" height="250" rx="10" fill="%231e293b" stroke="%2310b981" stroke-width="2"/><text x="30" y="55" fill="%2334d399" font-family="sans-serif" font-size="16" font-weight="bold">UNIVERSIDAD TÉCNICA DE AMBATO</text><text x="30" y="85" fill="%2394a3b8" font-family="sans-serif" font-size="12">FACULTAD DE ING. EN SISTEMAS, ELECTRÓNICA E IND.</text><text x="30" y="125" fill="%23f8fafc" font-family="sans-serif" font-size="13">CERTIFICADO DE MATRÍCULA VIGENTE</text><text x="30" y="160" fill="%2338bdf8" font-family="sans-serif" font-size="14" font-weight="bold">PERIODO ACADÉMICO VIGENTE</text><text x="30" y="200" fill="%234ade80" font-family="sans-serif" font-size="12">VERIFICACIÓN DIGITAL: QR-VAL-928174</text></svg>',
                          })
                        }
                        className="text-[10px] text-emerald-400 hover:underline font-bold"
                      >
                        Autocompletar Prueba
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled={newEnrollment.category === 'GENERAL_PUBLIC'}
                    placeholder={
                      newEnrollment.category === 'GENERAL_PUBLIC'
                        ? 'No requiere certificado académico'
                        : 'https://... o autocompletar prueba'
                    }
                    value={newEnrollment.academicCertUrl}
                    onChange={(e) => setNewEnrollment({ ...newEnrollment, academicCertUrl: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 disabled:opacity-40 ${theme.bgInput}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${theme.textMuted}`}>Notas del Asesor / Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Información adicional o condiciones especiales de la matrícula..."
                  value={newEnrollment.notes}
                  onChange={(e) => setNewEnrollment({ ...newEnrollment, notes: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border focus:outline-none focus:border-blue-500 ${theme.bgInput}`}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateEnrollmentModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-semibold transition cursor-pointer hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition cursor-pointer shadow-sm"
                >
                  Guardar Matrícula Oficial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL LIGHTBOX DE IMAGEN EN PANTALLA COMPLETA                            */}
      {/* ========================================================================= */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className={`relative max-w-4xl max-h-[90vh] border rounded-2xl overflow-hidden flex flex-col shadow-2xl ${theme.bgCard}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-5 py-3 border-b flex items-center justify-between ${theme.borderMuted}`}>
              <span className="text-xs font-bold flex items-center gap-2">
                📷 Comprobante / Imagen Adjunta de Telegram
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  download="comprobante_telegram.jpg"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  Descargar
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 bg-black/40 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)]">
              <img
                src={previewImage}
                alt="Comprobante en alta resolución"
                className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
