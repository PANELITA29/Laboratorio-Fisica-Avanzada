import React, { useState } from 'react';
import { BookOpen, X, Zap, GitMerge, AlertTriangle, Orbit, Lightbulb } from 'lucide-react';
import { Language } from '../assets/js/i18n';

interface TheoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

type TheoryTab = 'ohm' | 'kirchhoff' | 'topologies' | 'faults' | 'kepler' | 'analogies';

export const TheoryModal: React.FC<TheoryModalProps> = ({ isOpen, onClose, lang }) => {
  const [activeTab, setActiveTab] = useState<TheoryTab>('ohm');

  if (!isOpen) return null;

  const tabs: Array<{ id: TheoryTab; labelEs: string; labelEn: string; icon: React.ReactNode }> = [
    { id: 'ohm', labelEs: '1. Ley de Ohm y Joule', labelEn: '1. Ohm & Joule Laws', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'kirchhoff', labelEs: '2. Leyes de Kirchhoff', labelEn: '2. Kirchhoff Laws', icon: <GitMerge className="w-3.5 h-3.5" /> },
    { id: 'topologies', labelEs: '3. Topologías 3D', labelEn: '3. 3D Topologies', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'faults', labelEs: '4. Modos de Falla', labelEn: '4. Fault Modes', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { id: 'kepler', labelEs: '5. Kepler y Hohmann', labelEn: '5. Kepler & Hohmann', icon: <Orbit className="w-3.5 h-3.5" /> },
    { id: 'analogies', labelEs: '6. Analogías Hidráulicas', labelEn: '6. Hydraulic Analogies', icon: <Lightbulb className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theory-modal-title"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#0B0F1A] border border-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F1626] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 block">
                ENCICLOPEDIA CIENTÍFICA QUANTUMLABS · PHET FORMULA
              </span>
              <h2 id="theory-modal-title" className="text-lg font-bold text-white">
                {lang === 'es'
                  ? 'Fundamentos Teóricos, Ecuaciones y Demostraciones'
                  : 'Theoretical Foundations, Equations & Proofs'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'es' ? 'Cerrar Fundamentos' : 'Close Foundations'}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-[#090D16] border-b border-slate-800 flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-[#0F1626] text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {tab.icon}
              <span>{lang === 'es' ? tab.labelEs : tab.labelEn}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[68vh] overflow-y-auto text-xs text-slate-300 leading-relaxed">
          {activeTab === 'ohm' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0F172A] border border-cyan-500/30">
                <h3 className="text-sm font-bold text-white mb-1">
                  Ley de Ohm Microscópica y Macroscópica (Georg Simon Ohm, 1827)
                </h3>
                <p>
                  La intensidad de corriente eléctrica estacionaria <strong className="text-cyan-300 font-mono">I</strong> que circula por un conductor óhmico es directamente proporcional a la diferencia de potencial <strong className="text-amber-300 font-mono">ΔV</strong> aplicada entre sus bornes e inversamente proporcional a su resistencia eléctrica <strong className="text-emerald-300 font-mono">R</strong>.
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-center">
                  <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">CORRIENTE (AMPERIOS)</span>
                    <span className="text-base font-bold text-cyan-400">I = V / R</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">TENSIÓN (VOLTIOS)</span>
                    <span className="text-base font-bold text-amber-400">V = I · R</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">LEY DE JOULE (VATIOS)</span>
                    <span className="text-base font-bold text-emerald-400">P = V · I = I² · R</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800">
                  <h4 className="font-bold text-cyan-300 mb-1">Interpretación en la Gráfica V vs. I</h4>
                  <p>
                    En el osciloscopio de la Zona 3, la pendiente de la recta Voltaje (eje vertical) frente a Corriente (eje horizontal) representa exactamente la resistencia equivalente: <span className="font-mono text-white">m = ΔV / ΔI = R_eq</span>.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800">
                  <h4 className="font-bold text-amber-300 mb-1">Hipérbola Equilátera I vs. R</h4>
                  <p>
                    Al mantener constante la tensión de la fuente DC (<span className="font-mono text-white">V = cte</span>), la corriente describe una curva hiperbólica decreciente <span className="font-mono text-white">I(R) = V / R</span>: cuando <span className="font-mono">R → 0</span> (cortocircuito), <span className="font-mono">I → ∞</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'kirchhoff' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0F172A] border border-cyan-500/30 space-y-2">
                  <span className="text-[11px] font-mono text-cyan-400 uppercase">1ª LEY (NODOS / CONSERVACIÓN DE CARGA)</span>
                  <h3 className="text-sm font-bold text-white">Ley de Corrientes de Kirchhoff (LCK)</h3>
                  <p>
                    En cualquier nodo o punto de bifurcación de una red eléctrica, la suma algebraica de las corrientes que entran es igual a la suma de las corrientes que salen:
                  </p>
                  <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800 font-mono text-cyan-300 text-center">
                    ∑ I_entrantes = ∑ I_salientes   ⇒   ∑ I_k = 0
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0F172A] border border-purple-500/30 space-y-2">
                  <span className="text-[11px] font-mono text-purple-400 uppercase">2ª LEY (MALLAS / CONSERVACIÓN DE ENERGÍA)</span>
                  <h3 className="text-sm font-bold text-white">Ley de Voltajes de Kirchhoff (LVK)</h3>
                  <p>
                    En toda trayectoria cerrada (malla), la suma algebraica de las fuerzas electromotrices aplicadas es igual a la suma de las caídas de tensión pasivas:
                  </p>
                  <div className="p-2.5 rounded-lg bg-[#07090E] border border-slate-800 font-mono text-purple-300 text-center">
                    ∑ ΔV_malla = V_fuente - V₁ - V₂ - V₃ = 0
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800">
                <h4 className="font-bold text-emerald-400 mb-1">Transitorios RC y Carga de Condensador</h4>
                <p>
                  Cuando se activa el modo <strong className="text-white">Transitorio RC + LED 3D</strong>, la tensión en el capacitor evoluciona según la ecuación diferencial de primer orden con constante de tiempo <span className="font-mono text-cyan-300">τ = R · C</span>:
                </p>
                <div className="mt-2 p-2.5 rounded-lg bg-[#07090E] border border-slate-800 font-mono text-emerald-300 text-center">
                  V_C(t) = V₀ · (1 - e^(-t / R·C))   |   I_C(t) = (V₀ / R) · e^(-t / R·C)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'topologies' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-2">
                <span className="text-[11px] font-mono text-cyan-400">TOPOLOGÍA 1</span>
                <h3 className="text-sm font-bold text-white">Circuito en Serie</h3>
                <p>
                  Una única trayectoria para la corriente (<span className="font-mono text-white">I_T = I₁ = I₂ = I₃</span>). La tensión de la fuente se reparte proporcionalmente al valor de cada resistencia (divisor de tensión):
                </p>
                <div className="p-2 rounded bg-[#07090E] font-mono text-cyan-300 text-center">
                  R_eq = R₁ + R₂ + R₃
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-2">
                <span className="text-[11px] font-mono text-purple-400">TOPOLOGÍA 2</span>
                <h3 className="text-sm font-bold text-white">Circuito en Paralelo</h3>
                <p>
                  Todos los elementos comparten los mismos nodos equipotenciales (<span className="font-mono text-white">V_T = V₁ = V₂ = V₃</span>). La corriente principal se divide inversamente a las resistencias:
                </p>
                <div className="p-2 rounded bg-[#07090E] font-mono text-purple-300 text-center">
                  1 / R_eq = 1/R₁ + 1/R₂ + 1/R₃
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-2">
                <span className="text-[11px] font-mono text-amber-400">TOPOLOGÍA 3</span>
                <h3 className="text-sm font-bold text-white">Circuito Mixto</h3>
                <p>
                  Combina <span className="font-mono text-white">R₁</span> en serie en el tronco principal con el bloque paralelo <span className="font-mono text-white">(R₂ ∥ R₃)</span>. Combina divisor de tensión y divisor de corriente:
                </p>
                <div className="p-2 rounded bg-[#07090E] font-mono text-amber-300 text-center">
                  R_eq = R₁ + (R₂ · R₃) / (R₂ + R₃)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'faults' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                <h3 className="text-sm font-bold text-amber-300">Falla 1: Circuito Abierto (ABRIR / OPEN)</h3>
                <p>
                  Representa un conductor roto o interruptor abierto (<span className="font-mono text-white">R_rama → ∞</span>). En un circuito <strong>Serie</strong>, abrir cualquier resistencia interrumpe totalmente la corriente (<span className="font-mono">I_T = 0 A</span>) y toda la tensión de la fuente aparece entre los bornes abiertos. En <strong>Paralelo</strong>, solo se apaga la rama abierta mientras las demás siguen operando.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-2">
                <h3 className="text-sm font-bold text-rose-300">Falla 2: Cortocircuito (CORTO / SHORT)</h3>
                <p>
                  Representa un puente de impedancia nula (<span className="font-mono text-white">R_rama → 0 Ω</span>). En un circuito <strong>Paralelo</strong>, un cortocircuito en cualquier rama drena toda la corriente por la vía de resistencia cero, anulando la tensión en las demás ramas y disparando la protección térmica de la fuente DC.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'kepler' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
                  <h4 className="font-bold text-purple-300">1ª, 2ª y 3ª Ley de Kepler</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>1ª Ley (Órbitas Elípticas):</strong> <span className="font-mono text-white">r_p = a(1 - e)</span> y <span className="font-mono text-white">r_a = a(1 + e)</span> con el Sol en uno de los focos.</li>
                    <li><strong>2ª Ley (Áreas Iguales):</strong> La velocidad areal <span className="font-mono text-white">dA/dt = L/(2m)</span> es constante; el planeta acelera en el perihelio y frena en el afelio.</li>
                    <li><strong>3ª Ley (Armónica):</strong> <span className="font-mono text-cyan-300">T² = a³ / M</span> (en años y Unidades Astronómicas).</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
                  <h4 className="font-bold text-cyan-300">Velocidad de Escape y Transferencia de Hohmann</h4>
                  <p>
                    Para escapar del pozo gravitacional, la energía total debe ser <span className="font-mono text-white">E = K + U ≥ 0</span>, lo que exige <span className="font-mono text-amber-300">v_esc = √(2GM / r) = √2 · v_circular</span>.
                  </p>
                  <p>
                    La <strong>Transferencia de Hohmann</strong> conecta dos órbitas circulares <span className="font-mono">r₁ → r₂</span> mediante una semielipse tangente con semieje <span className="font-mono text-white">a_trans = (r₁ + r₂)/2</span> aplicando dos impulsos <span className="font-mono text-emerald-300">Δv₁</span> y <span className="font-mono text-emerald-300">Δv₂</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analogies' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-amber-300">Voltaje (V) ≈ Bomba de Presión Hidráulica</h4>
                <p>
                  La fuente DC de sobremesa actúa como una bomba de agua que mantiene una diferencia de altura o presión hidrostática entre el borne positivo (+) y tierra (-). Sin presión (<span className="font-mono">V = 0</span>), las cargas libres permanecen en reposo neto.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-cyan-300">Corriente (I) ≈ Caudal Volumétrico</h4>
                <p>
                  La corriente eléctrica en Amperios (<span className="font-mono">1 A = 1 C/s</span>) equivale a los litros por segundo que cruzan la sección transversal de una tubería. En una tubería sin fugas (nodos LCK), toda el agua que entra debe salir.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0D1322] border border-slate-800 space-y-1.5">
                <h4 className="font-bold text-emerald-300">Resistencia (R) ≈ Estrechamiento en Tubería</h4>
                <p>
                  Una resistencia eléctrica actúa como un filtro poroso o reducción de diámetro que se opone al paso del fluido, transformando energía cinética de los electrones en calor por fricción (Efecto Joule <span className="font-mono">P = I²R</span>).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#0F1626] border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono">
            QuantumLabs · Guía de Defensa Científica para Jurados de Feria de la Ciencia
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            {lang === 'es' ? 'Entendido' : 'Got It'}
          </button>
        </div>
      </div>
    </div>
  );
};
