/**
 * data/theoryData.js
 * Módulos Teóricos Fundamentales y Aplicaciones en la Vida Real.
 * Explicación detallada de Ley de Ohm, Leyes de Kirchhoff y Topologías de Circuitos.
 */

export const THEORY_MODULES = {
  ohm: {
    id: "ohm",
    title: "1. Ley de Ohm: El Fundamento de la Electrodinámica",
    subtitle: "Relación cuantitativa entre Tensión, Corriente y Resistencia",
    concept: `
      Descubierta experimentalmente por Georg Simon Ohm en 1827, establece que la intensidad de corriente eléctrica ($I$) que atraviesa un conductor metálico es directamente proporcional a la diferencia de potencial ($V$) aplicada entre sus extremos, e inversamente proporcional a la resistencia eléctrica ($R$) del medio.
    `,
    formula: "V = I \\cdot R \\quad \\Longleftrightarrow \\quad I = \\frac{V}{R} \\quad \\Longleftrightarrow \\quad R = \\frac{V}{I}",
    units: [
      { symbol: "V", name: "Voltaje / Tensión", unit: "Voltio (V)", desc: "Fuerza o presión eléctrica que impulsa a los electrones." },
      { symbol: "I", name: "Intensidad de Corriente", unit: "Amperio (A)", desc: "Caudal o tasa de flujo de carga eléctrica (1 A = 1 Culombio/segundo)." },
      { symbol: "R", name: "Resistencia Eléctrica", unit: "Ohmio (Ω)", desc: "Oposición intrínseca del material al libre paso de electrones." },
      { symbol: "P", name: "Potencia Eléctrica", unit: "Vatio (W)", desc: "Tasa de consumo o transformación de energía por unidad de tiempo (P = V · I = I²·R)." }
    ],
    analogy: {
      title: "💧 Analogía Hidráulica (La Tubería de Agua)",
      text: "Imagina un tanque de agua elevado conectado a una manguera:\n• El Voltaje (V) es la altura del tanque (presión del agua).\n• La Corriente (I) es la cantidad de litros de agua por segundo que salen por la manguera.\n• La Resistencia (R) es una válvula estranguladora o el estrechamiento de la manguera que restringe el paso del líquido."
    },
    realLifeExamples: [
      {
        title: "Regulador de Luz (Dimmer) o Control de Volumen",
        desc: "Al girar la perilla de un potenciómetro, aumentas la resistencia eléctrica, reduciendo la corriente que llega a la bombilla o parlante, atenuando la luz o el sonido de forma suave y controlada."
      },
      {
        title: "Cargador Rápido de Smartphone (Fast Charge)",
        desc: "Para cargar más rápido una batería sin sobrecalentar el cable por corriente excesiva, los protocolos (como USB-PD o QuickCharge) aumentan el voltaje (de 5V a 9V, 12V o 20V) para transferir mayor potencia ($P = V \\cdot I$) manteniendo el amperaje en rangos seguros."
      }
    ]
  },

  kirchhoff: {
    id: "kirchhoff",
    title: "2. Leyes de Kirchhoff: Conservación de Energía y Carga",
    subtitle: "Herramientas maestras para el análisis nodal y de mallas en redes eléctricas complejas",
    concept: `
      Formuladas por Gustav Robert Kirchhoff en 1845, son dos postulados fundamentales que derivan directamente de los principios de conservación de la carga eléctrica y conservación de la energía en el electromagnetismo.
    `,
    laws: [
      {
        name: "Primera Ley: Ley de Corrientes de Kirchhoff (LCK) / Ley de Nodos",
        principle: "Principio de Conservación de la Carga",
        statement: "La suma algebraica de todas las corrientes que entran a un nodo (unión de conductores) es idénticamente igual a la suma de las corrientes que salen de él. En otras palabras, la carga no se crea, no se destruye ni se acumula en un nodo.",
        formula: "\\sum I_{\\text{entrantes}} = \\sum I_{\\text{salientes}} \\quad \\Longleftrightarrow \\quad \\sum_{k=1}^n I_k = 0",
        example: "Si a un nodo entran 5A por un conductor y salen 3A por un ramal, forzosamente por el otro ramal saldrán 2A (5A = 3A + 2A)."
      },
      {
        name: "Segunda Ley: Ley de Voltajes de Kirchhoff (LVK) / Ley de Mallas",
        principle: "Principio de Conservación de la Energía",
        statement: "En cualquier lazo cerrado o malla de un circuito eléctrico, la suma algebraica de las diferencias de potencial eléctrico (fuentes de tensión y caídas de voltaje en resistores) debe ser siempre igual a cero.",
        formula: "\\sum V_{\\text{fuente}} = \\sum V_{\\text{caídas}} \\quad \\Longleftrightarrow \\quad \\sum_{k=1}^m V_k = 0",
        example: "Si una batería entrega 12V y alimenta tres resistencias en serie con caídas de 2V, 4V y 6V: 12V - (2V + 4V + 6V) = 0V."
      }
    ],
    realLifeExamples: [
      {
        title: "Tablero Eléctrico de Distribución Residencial (LCK)",
        desc: "La corriente total que entra por la acometida principal de la compañía eléctrica se reparte en los distintos disyuntores (iluminación, enchufes, aire acondicionado). La suma de los amperios consumidos por cada electrodoméstico es exactamente la corriente total facturada."
      },
      {
        title: "Sistema Eléctrico Automotriz (LVK)",
        desc: "El alternador y la batería de 12.6V en un automóvil suministran el voltaje exacto que se reparte entre los módulos electrónicos (ECU, luces, sensores). El análisis por LVK garantiza que los sensores reciban el voltaje de referencia adecuado sin fluctuaciones destructivas."
      }
    ]
  },

  topologies: {
    id: "topologies",
    title: "3. Topologías de Circuitos: Serie, Paralelo y Mixto",
    subtitle: "Comportamiento eléctrico comparativo y formulación matemática",
    concept: `
      La interconexión de componentes en un circuito determina cómo se distribuyen la corriente eléctrica y las diferencias de potencial. Comprender si los elementos comparten la misma corriente (serie) o el mismo voltaje (paralelo) es la base para diseñar sistemas eléctricos eficientes y seguros.
    `,
    types: [
      {
        name: "Circuito en Serie",
        badge: "Un solo camino de corriente",
        description: "Los componentes están conectados uno a continuación de otro de manera secuencial. Existe una única trayectoria cerrada para el movimiento de los electrones.",
        rules: [
          "Corriente Constante: I_T = I_1 = I_2 = I_3",
          "Voltaje Aditivo: V_T = V_1 + V_2 + V_3",
          "Resistencia Equivalente: R_eq = R_1 + R_2 + R_3 (Siempre mayor a cualquier R individual)"
        ],
        drawback: "Punto único de falla: Si una sola resistencia se abre (o se quema una bombilla), el circuito se interrumpe y todo el sistema se apaga.",
        realWorld: "Antiguas series de luces navideñas (cuando una bombilla se fundía, toda la tira dejaba de funcionar)."
      },
      {
        name: "Circuito en Paralelo",
        badge: "Mismo voltaje, múltiples caminos",
        description: "Los terminales de entrada de todos los componentes están unidos a un mismo nodo común, y los terminales de salida a otro nodo común.",
        rules: [
          "Voltaje Constante: V_T = V_1 = V_2 = V_3",
          "Corriente Aditiva: I_T = I_1 + I_2 + I_3",
          "Resistencia Equivalente: 1/R_eq = 1/R_1 + 1/R_2 + 1/R_3 (Siempre menor a la menor resistencia)"
        ],
        drawback: "Mayor consumo de corriente total si se agregan más ramas; requiere conductores de mayor calibre cerca de la fuente.",
        realWorld: "Todas las tomas de corriente y enchufes de una casa u oficina (puedes apagar la lámpara sin que se apague el refrigerador o el computador)."
      },
      {
        name: "Circuito Mixto (Serie-Paralelo)",
        badge: "Combinación de redes",
        description: "Estructura que combina ramas en serie con grupos en paralelo. En nuestro laboratorio: R1 en serie conectado a un bloque paralelo formado por R2 y R3.",
        rules: [
          "Resistencia del Bloque Paralelo: R_23 = (R_2 · R_3) / (R_2 + R_3)",
          "Resistencia Total: R_eq = R_1 + R_23",
          "Corriente Total: I_T = V_T / R_eq (Atraviesa R1)",
          "Voltaje en R1: V_1 = I_T · R_1; Voltaje en Paralelo: V_23 = V_T - V_1",
          "Corrientes en ramas: I_2 = V_23 / R_2; I_3 = V_23 / R_3"
        ],
        drawback: "Cálculo no lineal que requiere reducción progresiva de bloques equivalentes.",
        realWorld: "Circuitos electrónicos integrados, fuentes conmutadas, redes de filtrado de audio (crossover de altavoces) y paneles solares interconectados."
      }
    ]
  },

  faults: {
    id: "faults",
    title: "4. Módulo de Análisis de Fallas Eléctricas",
    subtitle: "Comportamiento del sistema ante condiciones críticas y anomalías",
    concept: `
      En ingeniería eléctrica, un circuito debe diseñarse contemplando no solo la operación normal, sino también los escenarios de falla crítica como cortocircuitos, ramas abiertas o sobrecargas térmicas para proteger vidas y equipos.
    `,
    conditions: [
      {
        name: "Circuito Abierto (Open Circuit - R = ∞)",
        cause: "Conductor cortado, interruptor abierto o filamento fundido.",
        effect: "La resistencia de la rama se vuelve infinita. La corriente en esa rama cae a exactamente 0A. En serie apaga todo el circuito; en paralelo simplemente anula esa rama.",
        prevention: "Mantenimiento preventivo, conectores con bloqueo de vibración y protección contra fatiga mecánica."
      },
      {
        name: "Cortocircuito (Short Circuit - R = 0Ω)",
        cause: "Contacto directo accidental entre conductores positivo y negativo sin carga resistiva intermedia.",
        effect: "Resistencia equivalente tiende a 0. La corriente intenta llegar al infinito (I → ∞). Se genera calor destructivo instantáneo ($P = I^2 \\cdot R$).",
        prevention: "Fusibles calibrados, disyuntores termomagnéticos (breakers) e interruptores diferenciales."
      },
      {
        name: "Sobrecarga de Potencia Térmica (Efecto Joule)",
        cause: "Exceso de corriente que hace que la disipación $P = I^2 \\cdot R$ supere la potencia nominal de disipación de la resistencia (ej. resistores de 1/4W, 1W o 10W).",
        effect: "La resistencia se carboniza, cambia de valor resistivo o se abre definitivamente emitiendo humo.",
        prevention: "Dimensionamiento con margen de seguridad del 100% (cálculo de potencia de diseño al doble de la disipada)."
      }
    ]
  }
};
