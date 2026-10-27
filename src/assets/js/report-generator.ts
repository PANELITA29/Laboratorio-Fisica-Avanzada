export interface TelemetryItem {
  label: string;
  value: string;
  unit: string;
}

export interface ScientificReportData {
  studentName: string;
  labName: string;
  question: string;
  hypothesis: string;
  variables: string;
  results: string;
  telemetry: TelemetryItem[];
  timestamp: string;
}

export function formatReportDate(date: Date = new Date()): string {
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function triggerScientificReportPrint(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}

export function generateScientificCSVString(data: ScientificReportData): string {
  const escapeCSV = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
  const rows: string[][] = [
    ['CAMPO', 'VALOR', 'UNIDAD / DETALLE'],
    ['Investigador Principal', data.studentName, 'QuantumLabs STEM'],
    ['Laboratorio Activo', data.labName, data.timestamp],
    ['Pregunta de Investigacion', data.question, 'Metodo Cientifico'],
    ['Hipotesis Formulada', data.hypothesis, 'Metodo Cientifico'],
    ['Variables Controladas', data.variables, 'Metodo Cientifico'],
    ['Analisis de Resultados', data.results, 'Conclusion'],
    ...data.telemetry.map((t) => [t.label, t.value, t.unit]),
  ];
  return rows.map((r) => r.map(escapeCSV).join(',')).join('\n');
}

export function downloadScientificReportCSV(data: ScientificReportData): void {
  if (typeof window === 'undefined') return;
  const csvContent = generateScientificCSVString(data);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Informe_QuantumLabs_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

