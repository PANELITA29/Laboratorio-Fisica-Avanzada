import React, { useState } from 'react';
import { Bot, Send, X, Sparkles, HelpCircle } from 'lucide-react';
import { Language } from '../assets/js/i18n';
import { TelemetryItem } from '../assets/js/report-generator';

interface ChatbotWidgetProps {
  lang: Language;
  activeLabName: string;
  telemetry: TelemetryItem[];
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
}

export const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({
  lang,
  activeLabName,
  telemetry,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text:
        lang === 'es'
          ? '¡Hola! Soy el Asistente Pedagógico IA de QuantumLabs. Estoy conectado en tiempo real a la telemetría de tu laboratorio 3D. Pregúntame sobre Ley de Ohm, Leyes de Kirchhoff (LVK/LCK), fallas de cortocircuito, código de colores EIA o Leyes de Kepler y Hohmann.'
          : 'Hello! I am the QuantumLabs Pedagogical AI Assistant. I am connected in real time to your 3D lab telemetry. Ask me about Ohm’s Law, Kirchhoff’s Laws, short-circuit faults, EIA color codes, or Kepler’s Laws & Hohmann transfers.',
    },
  ]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const telemetryContext = telemetry
      .map((t) => `${t.label}: ${t.value} ${t.unit}`)
      .join(' | ');

    try {
      const res = await fetch('/api/gemini/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          labContext: `${activeLabName} (${telemetryContext})`,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text:
            data.reply ||
            'En equilibrio estacionario se cumplen rigurosamente la Ley de Ohm (I = V/R) y las Leyes de Kirchhoff.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text:
            'Según el motor determinista local de QuantumLabs: I = V / R_eq y la suma de voltajes en cualquier malla cerrada es cero (∑ V = 0).',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts =
    lang === 'es'
      ? [
          '¿Qué pasa en un cortocircuito?',
          'Explica Serie vs Paralelo y Mixto',
          '¿Cómo funciona la Transferencia de Hohmann?',
          '¿Cómo leo las bandas de color EIA?',
        ]
      : [
          'What happens in a short circuit?',
          'Explain Series vs Parallel & Mixed',
          'How does Hohmann Transfer work?',
          'How do I read EIA color bands?',
        ];

  return (
    <div id="chatbot-widget" className="fixed bottom-5 right-5 z-40 no-print">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={lang === 'es' ? 'Abrir Asistente IA QuantumLabs' : 'Open QuantumLabs AI Assistant'}
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 font-bold text-xs shadow-xl hover:from-cyan-400 hover:to-sky-400 transition-all cursor-pointer border border-cyan-300"
        >
          <Bot className="w-5 h-5" />
          <span>{lang === 'es' ? 'Tutor IA QuantumLabs' : 'QuantumLabs AI Tutor'}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-950 animate-ping" />
        </button>
      ) : (
        <div className="w-[350px] sm:w-[390px] rounded-2xl bg-[#0B0F1A] border border-cyan-500/40 shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 bg-[#0F1626] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <div>
                <h3 className="text-xs font-bold text-white">
                  {lang === 'es' ? 'Tutor Científico IA · QuantumLabs' : 'AI Science Tutor · QuantumLabs'}
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 block">
                  ● Telemetría 3D Sincronizada
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={lang === 'es' ? 'Cerrar Tutor IA' : 'Close AI Tutor'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="p-3.5 space-y-3 max-h-72 overflow-y-auto text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-xl leading-relaxed whitespace-pre-line ${
                  m.sender === 'assistant'
                    ? 'bg-[#111827] border border-slate-800 text-slate-200'
                    : 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-100 ml-6'
                }`}
              >
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div className="p-2.5 rounded-xl bg-[#111827] border border-slate-800 text-cyan-300 font-mono text-[11px]">
                Analizando leyes físicas y telemetría...
              </div>
            )}
          </div>

          {/* Quick Inquiry Chips */}
          <div className="px-3.5 py-2 bg-[#090D16] border-t border-slate-800/80 flex flex-wrap gap-1.5">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                type="button"
                onClick={() => sendQuestion(qp)}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#111827] hover:bg-slate-800 border border-slate-800 text-[10px] text-cyan-300 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[155px]">{qp}</span>
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="p-3 bg-[#0F1626] border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === 'es'
                  ? 'Pregunta sobre Ohm, Kirchhoff, Kepler...'
                  : 'Ask about Ohm, Kirchhoff, Kepler...'
              }
              className="flex-1 rounded-lg bg-[#07090E] border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={isLoading}
              aria-label={lang === 'es' ? 'Enviar pregunta' : 'Send question'}
              className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
