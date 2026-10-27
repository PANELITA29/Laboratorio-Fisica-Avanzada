import React, { useState } from 'react';
import { Palette, X, Check, ArrowRight } from 'lucide-react';
import { Language } from '../assets/js/i18n';

interface ColorCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onApplyToResistor?: (target: 'R1' | 'R2' | 'R3', ohms: number) => void;
}

interface ColorEntry {
  digit: number;
  nameEs: string;
  nameEn: string;
  hex: string;
  multiplier: number;
  tolerance?: string;
}

const EIA_COLORS: ColorEntry[] = [
  { digit: 0, nameEs: 'Negro (0)', nameEn: 'Black (0)', hex: '#1E293B', multiplier: 1 },
  { digit: 1, nameEs: 'Marrón (1)', nameEn: 'Brown (1)', hex: '#78350F', multiplier: 10, tolerance: '±1%' },
  { digit: 2, nameEs: 'Rojo (2)', nameEn: 'Red (2)', hex: '#DC2626', multiplier: 100, tolerance: '±2%' },
  { digit: 3, nameEs: 'Naranja (3)', nameEn: 'Orange (3)', hex: '#EA580C', multiplier: 1000 },
  { digit: 4, nameEs: 'Amarillo (4)', nameEn: 'Yellow (4)', hex: '#EAB308', multiplier: 10000 },
  { digit: 5, nameEs: 'Verde (5)', nameEn: 'Green (5)', hex: '#16A34A', multiplier: 100000, tolerance: '±0.5%' },
  { digit: 6, nameEs: 'Azul (6)', nameEn: 'Blue (6)', hex: '#2563EB', multiplier: 1000000, tolerance: '±0.25%' },
  { digit: 7, nameEs: 'Violeta (7)', nameEn: 'Violet (7)', hex: '#7C3AED', multiplier: 10000000, tolerance: '±0.1%' },
  { digit: 8, nameEs: 'Gris (8)', nameEn: 'Gray (8)', hex: '#64748B', multiplier: 1 },
  { digit: 9, nameEs: 'Blanco (9)', nameEn: 'White (9)', hex: '#F8FAFC', multiplier: 1 },
];

const TOLERANCE_OPTIONS = [
  { id: 'gold', nameEs: 'Oro (±5%)', nameEn: 'Gold (±5%)', hex: '#D97706', tol: '±5%' },
  { id: 'silver', nameEs: 'Plata (±10%)', nameEn: 'Silver (±10%)', hex: '#94A3B8', tol: '±10%' },
  { id: 'brown', nameEs: 'Marrón (±1%)', nameEn: 'Brown (±1%)', hex: '#78350F', tol: '±1%' },
  { id: 'red', nameEs: 'Rojo (±2%)', nameEn: 'Red (±2%)', hex: '#DC2626', tol: '±2%' },
];

export const ColorCodeModal: React.FC<ColorCodeModalProps> = ({
  isOpen,
  onClose,
  lang,
  onApplyToResistor,
}) => {
  const [bandCount, setBandCount] = useState<4 | 5>(4);
  const [b1, setB1] = useState<number>(4); // Amarillo (4)
  const [b2, setB2] = useState<number>(7); // Violeta (7)
  const [b3, setB3] = useState<number>(0); // Negro (0) para 5 bandas
  const [multIdx, setMultIdx] = useState<number>(0); // x1 -> 47 Ω (fácil de sincronizar al rango 1-100 Ω de la mesa 3D)
  const [tolId, setTolId] = useState<string>('gold');
  const [syncedBadge, setSyncedBadge] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseDigits = bandCount === 4 ? b1 * 10 + b2 : b1 * 100 + b2 * 10 + b3;
  const multiplier = EIA_COLORS[multIdx]?.multiplier ?? 1;
  const calculatedOhms = Math.max(1, baseDigits * multiplier);
  const selectedTol = TOLERANCE_OPTIONS.find((t) => t.id === tolId) || TOLERANCE_OPTIONS[0];

  const formatResistance = (val: number) => {
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)} MΩ`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(2)} kΩ`;
    return `${val} Ω`;
  };

  const handleApply = (target: 'R1' | 'R2' | 'R3') => {
    if (onApplyToResistor) {
      onApplyToResistor(target, calculatedOhms);
      setSyncedBadge(target);
      setTimeout(() => setSyncedBadge(null), 1800);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eia-modal-title"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#0B0F1A] border border-slate-800 shadow-2xl overflow-hidden my-4 sm:my-8">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#0F1626] border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-cyan-400 block">
                NORMA INTERNACIONAL IEC 60062 / EIA-RS-279
              </span>
              <h2 id="eia-modal-title" className="text-base sm:text-lg font-bold text-white">
                {lang === 'es'
                  ? 'Calculadora Interactiva y Código de Colores EIA (4 y 5 Bandas)'
                  : 'Interactive EIA Resistor Color Code Calculator (4 & 5 Bands)'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'es' ? 'Cerrar Calculadora EIA' : 'Close EIA Calculator'}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Top Mode Switcher & Live Resistor SVG Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBandCount(4)}
                  className={`flex-1 py-2 px-2.5 sm:px-3 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                    bandCount === 4
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-[#0F1626] text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  Estándar 4 Bandas (±5%)
                </button>
                <button
                  type="button"
                  onClick={() => setBandCount(5)}
                  className={`flex-1 py-2 px-2.5 sm:px-3 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                    bandCount === 5
                      ? 'bg-purple-500 text-white border-purple-400'
                      : 'bg-[#0F1626] text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  Precisión 5 Bandas (±1%)
                </button>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#0F172A] border border-cyan-500/30 text-center space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase block">
                  VALOR NOMINAL CALCULADO
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-extrabold text-cyan-300 tabular-nums">
                  {formatResistance(calculatedOhms)} <span className="text-sm sm:text-base text-amber-300">{selectedTol.tol}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 block">
                  ({calculatedOhms.toLocaleString()} Ω exactos)
                </span>
              </div>
            </div>

            {/* Realistic Axial Ceramic Resistor Preview */}
            <div className="lg:col-span-7 p-4 sm:p-5 rounded-xl bg-[#070B14] border border-slate-800 flex flex-col items-center justify-center">
              <svg viewBox="0 0 420 120" className="w-full max-w-md h-24 sm:h-28">
                {/* Axial Metallic Leads */}
                <line x1="20" y1="60" x2="105" y2="60" stroke="#94A3B8" strokeWidth="8" strokeLinecap="round" />
                <line x1="315" y1="60" x2="400" y2="60" stroke="#94A3B8" strokeWidth="8" strokeLinecap="round" />
                {/* Ceramic Body */}
                <rect
                  x="95"
                  y="24"
                  width="230"
                  height="72"
                  rx="24"
                  fill={bandCount === 5 ? '#BAE6FD' : '#FEF3C7'}
                  stroke="#D97706"
                  strokeWidth="3"
                />
                {/* Bands */}
                <rect x="130" y="24" width="16" height="72" fill={EIA_COLORS[b1].hex} />
                <rect x="165" y="24" width="16" height="72" fill={EIA_COLORS[b2].hex} />
                {bandCount === 5 && (
                  <rect x="200" y="24" width="16" height="72" fill={EIA_COLORS[b3].hex} />
                )}
                <rect
                  x={bandCount === 5 ? '235' : '205'}
                  y="24"
                  width="16"
                  height="72"
                  fill={EIA_COLORS[multIdx].hex}
                />
                <rect x="280" y="24" width="16" height="72" fill={selectedTol.hex} />
              </svg>

              {/* Direct 1-Click Synchronization to R1, R2, R3 */}
              {onApplyToResistor && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    Sincronizar con Mesa 3D:
                  </span>
                  {(['R1', 'R2', 'R3'] as const).map((rId) => (
                    <button
                      key={rId}
                      type="button"
                      onClick={() => handleApply(rId)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/40 text-xs font-mono font-bold text-cyan-200 transition-colors cursor-pointer"
                    >
                      {syncedBadge === rId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>¡Aplicado a {rId}!</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Enviar a {rId}</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Band Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label htmlFor="eia-b1" className="block font-mono text-slate-300 mb-1">
                1ª Banda (Dígito 1)
              </label>
              <select
                id="eia-b1"
                value={b1}
                onChange={(e) => setB1(parseInt(e.target.value, 10))}
                className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-2.5 py-2 font-mono text-white"
              >
                {EIA_COLORS.slice(1).map((c) => (
                  <option key={c.digit} value={c.digit}>
                    {lang === 'es' ? c.nameEs : c.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="eia-b2" className="block font-mono text-slate-300 mb-1">
                2ª Banda (Dígito 2)
              </label>
              <select
                id="eia-b2"
                value={b2}
                onChange={(e) => setB2(parseInt(e.target.value, 10))}
                className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-2.5 py-2 font-mono text-white"
              >
                {EIA_COLORS.map((c) => (
                  <option key={c.digit} value={c.digit}>
                    {lang === 'es' ? c.nameEs : c.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {bandCount === 5 && (
              <div>
                <label htmlFor="eia-b3" className="block font-mono text-slate-300 mb-1">
                  3ª Banda (Dígito 3)
                </label>
                <select
                  id="eia-b3"
                  value={b3}
                  onChange={(e) => setB3(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-2.5 py-2 font-mono text-white"
                >
                  {EIA_COLORS.map((c) => (
                    <option key={c.digit} value={c.digit}>
                      {lang === 'es' ? c.nameEs : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="eia-mult" className="block font-mono text-slate-300 mb-1">
                Multiplicador (×10ⁿ)
              </label>
              <select
                id="eia-mult"
                value={multIdx}
                onChange={(e) => setMultIdx(parseInt(e.target.value, 10))}
                className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-2.5 py-2 font-mono text-white"
              >
                {EIA_COLORS.slice(0, 7).map((c) => (
                  <option key={c.digit} value={c.digit}>
                    ×{c.multiplier.toLocaleString()} Ω ({lang === 'es' ? c.nameEs.split(' ')[0] : c.nameEn.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="eia-tol" className="block font-mono text-slate-300 mb-1">
                Tolerancia (%)
              </label>
              <select
                id="eia-tol"
                value={tolId}
                onChange={(e) => setTolId(e.target.value)}
                className="w-full rounded-lg bg-[#07090E] border border-slate-700 px-2.5 py-2 font-mono text-white"
              >
                {TOLERANCE_OPTIONS.map((tOpt) => (
                  <option key={tOpt.id} value={tOpt.id}>
                    {lang === 'es' ? tOpt.nameEs : tOpt.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Standard EIA Color Reference Table */}
          <div className="rounded-xl border border-slate-800 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs font-mono">
              <thead className="bg-[#0F1626] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Color</th>
                  <th className="py-2 px-3">Dígito</th>
                  <th className="py-2 px-3">Multiplicador</th>
                  <th className="py-2 px-3">Tolerancia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 bg-[#090D16]">
                {EIA_COLORS.slice(0, 8).map((c) => (
                  <tr key={c.digit}>
                    <td className="py-1.5 px-3 flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-sm border border-slate-600 inline-block shrink-0"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-slate-200">{lang === 'es' ? c.nameEs : c.nameEn}</span>
                    </td>
                    <td className="py-1.5 px-3 text-cyan-300">{c.digit}</td>
                    <td className="py-1.5 px-3 text-amber-300">×{c.multiplier.toLocaleString()} Ω</td>
                    <td className="py-1.5 px-3 text-emerald-300">{c.tolerance || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
