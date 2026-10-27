import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Endpoint del Asistente Virtual Pedagógico QuantumLabs (Server-Side Gemini API)
  app.post('/api/gemini/assistant', async (req, res) => {
    const { message, labContext } = req.body as {
      message?: string;
      labContext?: string;
    };

    const userPrompt = (message || '').trim();
    if (!userPrompt) {
      res.status(400).json({ error: 'Mensaje vacío.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      // Fallback determinista local pedagógico si no hay API key configurada
      res.json({
        reply: generateDeterministicPedagogicalReply(userPrompt, labContext || ''),
        mode: 'deterministic-local',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `Eres el Asistente Pedagógico Inteligente de "QuantumLabs — LabFísica Avanzada", proyecto de investigación científica de Juan David González Alarcón inspirado en PhET Colorado.
Tu objetivo es guiar a estudiantes y jurados de la feria científica con rigor físico, claridad intuitiva y entusiasmo académico.
Contexto actual en vivo del laboratorio del usuario:
${labContext || 'Hub Principal QuantumLabs'}

Reglas de respuesta:
1. Responde en español claro, conciso (máximo 2-3 párrafos breves) y con fórmulas explícitas cuando aplique (V = I·R, LCK, LVK, F = G·M·m/r², T² ∝ a³, E = K + U, V(t) = V₀(1 - e^(-t/RC))).
2. Relaciona siempre tu explicación con las lecturas actuales que tiene el estudiante en su mesa de trabajo 3D.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.4,
        },
      });

      const text = response.text || generateDeterministicPedagogicalReply(userPrompt, labContext || '');
      res.json({ reply: text, mode: 'gemini-cloud' });
    } catch (err) {
      // Fallback determinista local ante cualquier error de red o cuota
      res.json({
        reply: generateDeterministicPedagogicalReply(userPrompt, labContext || ''),
        mode: 'deterministic-local',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuantumLabs Server running on http://localhost:${PORT}`);
  });
}

function generateDeterministicPedagogicalReply(query: string, context: string): string {
  const q = query.toLowerCase();
  if (q.includes('kirchhoff') || q.includes('lvk') || q.includes('lck') || q.includes('malla')) {
    return `Las **Leyes de Kirchhoff** gobiernan toda topología eléctrica en nuestra mesa 3D:\n1. **LCK (1ª Ley - Nodos):** La suma algebraica de corrientes que entran a un nodo es igual a la suma de corrientes que salen ($\\sum I_{in} = \\sum I_{out}$), por conservación de la carga.\n2. **LVK (2ª Ley - Mallas):** En cualquier lazo cerrado, la suma de subidas de potencial de la fuente DC iguala exactamente la suma de caídas de potencial ($\\sum V_k = 0$).\n\nEstado actual de tu laboratorio: ${context}`;
  }
  if (q.includes('corto') || q.includes('abierto') || q.includes('falla') || q.includes('short')) {
    return `En el **Análisis de Fallas por Rama**:\n• **Circuito Abierto (OPEN):** La resistencia tiende a infinito ($R \\to \\infty$), impidiendo el paso de corriente ($I = 0\\text{ A}$) en esa rama.\n• **Cortocircuito (SHORT):** La resistencia cae a casi cero ($R \\approx 0\\,\\Omega$), provocando que toda la corriente se desvíe por esa vía de mínima impedancia, limitada únicamente por la impedancia interna de seguridad de la fuente DC ($R_{int} = 0.5\\,\\Omega$).`;
  }
  if (q.includes('kepler') || q.includes('hohmann') || q.includes('orbita') || q.includes('órbita') || q.includes('escape')) {
    return `En el **Laboratorio de Astronomía 3D**:\n• **1ª y 2ª Ley de Kepler:** Los planetas describen elipses con el Sol en un foco ($r(\\theta) = \\frac{a(1-e^2)}{1+e\\cos\\theta}$), moviéndose más rápido en el **perihelio** y más lento en el **afelio** (velocidad areal constante $dA/dt = \\text{cte}$).\n• **3ª Ley de Kepler:** El cuadrado del período orbital es proporcional al cubo del semieje mayor ($T^2 \\propto a^3$).\n• **Velocidad de Escape:** $v_{esc} = \\sqrt{2GM/r} = \\sqrt{2}\\,v_{circular}$.`;
  }
  if (q.includes('color') || q.includes('banda') || q.includes('eia') || q.includes('resistencia')) {
    return `El **Código de Colores EIA (IEC 60062)** codifica el valor óhmico sobre el cuerpo cilíndrico de la resistencia:\n• **4 Bandas:** 1ª y 2ª banda = dígitos significativos; 3ª banda = multiplicador ($10^n$); 4ª banda = tolerancia (Oro $\\pm 5\\%$).\n• **5 Bandas (Alta Precisión):** 1ª, 2ª y 3ª banda = 3 dígitos significativos; 4ª banda = multiplicador; 5ª banda = tolerancia (Marrón $\\pm 1\\%$). Puedes sincronizar cualquier valor desde el modal **Código EIA** en la barra superior.`;
  }
  if (q.includes('rc') || q.includes('capacitor') || q.includes('led') || q.includes('transitori')) {
    return `En el modo **Constructor RC + LED**:\n• **Curva de Carga del Capacitor:** El voltaje crece exponencialmente según $V_C(t) = V_0(1 - e^{-t/\\tau})$, donde la constante de tiempo es $\\tau = R \\cdot C$. Al alcanzar $t = 5\\tau$, el capacitor está cargado al $99.3\\%$.\n• **Diodo LED 3D:** Conduce e ilumina en polarización directa cuando $V > V_f$ ($\\approx 2.0\\text{ V}$), pero si la corriente supera los $30\\text{ mA}$ nominales sin resistencia limitadora, sufre daño térmico (burnout).`;
  }
  return `**Asistente Pedagógico QuantumLabs:**\nEn este momento tu banco de pruebas registra: ${context}.\n\nRecuerda que por la **Ley de Ohm ($V = I \\cdot R_{eq}$)** la corriente es directamente proporcional al voltaje de la fuente e inversamente proporcional a la resistencia equivalente. Prueba cambiar entre topología **Serie**, **Paralelo** y **Mixto**, o arrastrar las resistencias y puntas de prueba 3D sobre la alfombrilla antiestática para observar cómo cambian las lecturas LCD y el osciloscopio en vivo.`;
}

startServer();
