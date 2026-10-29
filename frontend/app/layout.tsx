import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NEXUS FISEI — Ecosistema Multi-Agente & Gestión Conversacional',
  description: 'Consola de Supervisión y Handover Humano en Tiempo Real para el CTT-FISEI de la Universidad Técnica de Ambato.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased font-sans overflow-hidden">
        {children}
      </body>
    </html>
  );
}
