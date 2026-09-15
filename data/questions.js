/**
 * data/questions.js
 * Banco de 10 Preguntas de Evaluación y Sustentación Pedagógica.
 * Diseñadas con explicaciones desde cero (nivel principiante absoluto), analogías cotidianas y desglose paso a paso.
 */

export const QUIZ_QUESTIONS = [
  {
    id: 1,
    title: "Pregunta 1: ¿Qué pasa si aumentas el Voltaje? (Ley de Ohm)",
    prompt: "Imagina que tienes un circuito con una resistencia fija de 10Ω. Si la batería era de 12V y decides cambiarla por una más potente de 24V (el doble de fuerza), ¿qué le pasará a la corriente (los amperios) que viaja por el cable?",
    options: [
      { id: "A", text: "La corriente disminuye a la mitad porque la batería es más pesada." },
      { id: "B", text: "La corriente se DUPLICA (se hace el doble de grande)." },
      { id: "C", text: "La corriente no cambia nada porque la resistencia sigue siendo de 10Ω." },
      { id: "D", text: "La corriente se vuelve cero porque el circuito se asusta y se apaga." }
    ],
    correctAnswer: "B",
    justification: {
      law: "Ley de Ohm: Más empuje = Más flujo (I = V / R)",
      explanation: "Piensa en el Voltaje (V) como la FUERZA O PRESIÓN con la que empujas agua por una manguera, y en la Corriente (I) como la CANTIDAD de agua que sale por segundo. Si empujas con el DOBLE de fuerza (24V en vez de 12V) y la manguera tiene el mismo grosor (10Ω), forzosamente saldrá el DOBLE de agua. Matemáticamente: I = 24V / 10Ω = 2.4A (antes era 12V / 10Ω = 1.2A).",
      formula: "I = \\frac{V}{R} \\implies \\text{Si } V \\times 2 \\implies I \\times 2",
      realWorldTip: "Por eso si a un foco de linterna de 1.5V le metes una batería de 9V, le estás dando 6 veces más empuje: pasa tanta corriente que el filamento se derrite y el foco se quema en un milisegundo."
    }
  },
  {
    id: 2,
    title: "Pregunta 2: ¿Qué hace una Resistencia más grande? (Ley de Ohm)",
    prompt: "Si mantienes el voltaje de la batería constante en 12V, pero cambias la resistencia por una mucho MÁS GRANDE (de 10Ω la subes a 100Ω), ¿qué ocurre con la corriente?",
    options: [
      { id: "A", text: "La corriente AUMENTA porque hay más ohmios empujando." },
      { id: "B", text: "La corriente DISMINUYE drásticamente porque el camino es mucho más difícil de atravesar." },
      { id: "C", text: "La corriente se mantiene igual, los ohmios no afectan a los amperios." },
      { id: "D", text: "El voltaje de la batería se transforma en calor y se borra." }
    ],
    correctAnswer: "B",
    justification: {
      law: "Ley de Ohm: A mayor resistencia, menor corriente (Oposición al flujo)",
      explanation: "La palabra 'Resistencia' significa literalmente 'freno u oposición'. Imagina que vas corriendo por un pasillo libre y de pronto te meten en un pasillo lleno de obstáculos y barro (resistencia alta). Tu velocidad disminuye. Con 10Ω pasaban 1.2A; al subir la resistencia a 100Ω, la corriente baja a solo 0.12A (10 veces menos).",
      formula: "I = \\frac{V}{R} \\implies \\text{Si } R \\uparrow \\implies I \\downarrow",
      realWorldTip: "Así funcionan las perillas de volumen o los atenuadores de luz de tu casa: cuando bajas el volumen, la perilla mete más resistencia al cable, pasa menos corriente a las bocinas y suena más suave."
    }
  },
  {
    id: 3,
    title: "Pregunta 3: ¿La corriente se gasta en el primer foco? (Circuito Serie)",
    prompt: "En un circuito en SERIE con 3 focos seguidos (R1, R2 y R3), ¿cuánta corriente pasa por el último foco comparado con el primero?",
    options: [
      { id: "A", text: "El último foco recibe menos corriente porque los dos primeros focos se la 'comieron' casi toda." },
      { id: "B", text: "Pasa EXACTAMENTE LA MISMA CORRIENTE por los 3 focos (I_T = I1 = I2 = I3)." },
      { id: "C", text: "El último foco recibe más corriente porque la electricidad toma impulso al final." },
      { id: "D", text: "Solo el foco del centro recibe corriente." }
    ],
    correctAnswer: "B",
    justification: {
      law: "Regla de Oro del Circuito Serie: Un solo camino cerrado",
      explanation: "La corriente NO se gasta como la gasolina; la corriente son electrones marchando en fila india por un solo carril de cable cerrado. Como solo hay un camino, cada electrón que entra por el foco 1 TIENE que pasar obligatoriamente por el foco 2 y por el foco 3. Lo que se reparte es el voltaje (la energía), pero los amperios (el caudal de electrones) son idénticos en todo el circuito.",
      formula: "I_{\\text{Total}} = I_1 = I_2 = I_3",
      realWorldTip: "Es como una pista de autos de un solo carril: si hay 10 autos circulando por minuto, los 10 autos pasarán por el puente 1, por el puente 2 y por el puente 3; ninguno desaparece mágicamente."
    }
  },
  {
    id: 4,
    title: "Pregunta 4: Resistencia Total en Serie (Suma de Oposiciones)",
    prompt: "Si conectas tres resistencias en SERIE de 10Ω, 20Ω y 30Ω, ¿cuál es la Resistencia Equivalente (Req) total que siente la batería?",
    options: [
      { id: "A", text: "Req = 60Ω (La suma directa: 10 + 20 + 30)." },
      { id: "B", text: "Req = 10Ω (Solo cuenta la más chiquita)." },
      { id: "C", text: "Req = 20Ω (El promedio de las tres)." },
      { id: "D", text: "Req = 0Ω (Se cancelan entre sí)." }
    ],
    correctAnswer: "A",
    justification: {
      law: "Cálculo de Resistencia en Serie: Req = R1 + R2 + R3",
      explanation: "En serie, los electrones tienen que vencer un obstáculo tras otro de manera consecutiva. Si pasas por un peaje de 10Ω, luego por otro de 20Ω y luego por otro de 30Ω, la dificultad total acumulada es la suma de los tres peajes: 10 + 20 + 30 = 60Ω. En serie la resistencia total SIEMPRE es mayor que cualquiera de las individuales.",
      formula: "R_{eq} = R_1 + R_2 + R_3 = 10 + 20 + 30 = 60\\,\\Omega",
      realWorldTip: "Por eso, si pones muchos aparatos en serie, la resistencia total se hace tan gigante que casi no circula corriente y los focos apenas brillan."
    }
  },
  {
    id: 5,
    title: "Pregunta 5: ¿Cómo se reparte el Voltaje en Serie? (LVK)",
    prompt: "En un circuito en SERIE alimentado por una batería de 12V con 3 resistencias (R1=10Ω, R2=20Ω, R3=30Ω), ¿cómo se reparten los voltajes V1, V2 y V3?",
    options: [
      { id: "A", text: "Cada resistencia recibe 12V completos (12V + 12V + 12V = 36V creados de la nada)." },
      { id: "B", text: "El voltaje de 12V se reparte en proporciones: V1=2V, V2=4V y V3=6V (Suman exactamente 12V)." },
      { id: "C", text: "R3 se queda con todos los 12V y las demás reciben 0V." },
      { id: "D", text: "El voltaje se pierde en el cable y todas marcan 0V." }
    ],
    correctAnswer: "B",
    justification: {
      law: "Ley de Voltajes de Kirchhoff (LVK): La energía no se crea de la nada",
      explanation: "El voltaje de la batería (12V) es como un pastel de energía que los componentes se deben repartir por completo. La resistencia más grande (R3=30Ω) pone más resistencia y por eso le quita más voltaje (6V); la mediana (R2=20Ω) se lleva 4V; y la más chica (R1=10Ω) se lleva 2V. La suma de todas las caídas es: 2V + 4V + 6V = 12V exactos.",
      formula: "V_{\\text{fuente}} = V_1 + V_2 + V_3 \\implies 12\\text{V} = 2\\text{V} + 4\\text{V} + 6\\text{V}",
      realWorldTip: "Esta es la base de los 'divisores de voltaje' que usan los celulares para saber cuánta batería te queda o para medir la temperatura con un termistor."
    }
  },
  {
    id: 6,
    title: "Pregunta 6: El Secreto del Circuito Paralelo (Voltaje en el Hogar)",
    prompt: "En tu casa todos los enchufes y electrodomésticos están conectados en PARALELO. Si la red entrega 120V, ¿cuánto voltaje recibe tu televisor, tu refrigerador y tu bombillo?",
    options: [
      { id: "A", text: "Todos reciben los mismos 120V completos e independientes." },
      { id: "B", text: "Los 120V se dividen entre los 3 aparatos, tocándole 40V a cada uno." },
      { id: "C", text: "El refrigerador recibe 120V y deja sin nada al televisor." },
      { id: "D", text: "Ninguno recibe voltaje a menos que estén todos prendidos al mismo tiempo." }
    ],
    correctAnswer: "A",
    justification: {
      law: "Regla de Oro del Circuito Paralelo: Mismo Voltaje en todas las ramas",
      explanation: "En un circuito en paralelo, los cables de cada aparato van directamente conectados a los dos polos de la fuente. Como todos están conectados a los mismos dos puntos comunes, todos reciben la misma 'presión' eléctrica: V_fuente = V1 = V2 = V3 = 120V.",
      formula: "V_{\\text{fuente}} = V_1 = V_2 = V_3",
      realWorldTip: "¡Por eso el mundo funciona en paralelo! Puedes conectar el microondas sin que la luz de la sala baje de brillo ni cambie su voltaje."
    }
  },
  {
    id: 7,
    title: "Pregunta 7: Resistencia en Paralelo (¿Por qué se hace más chiquita?)",
    prompt: "Si conectas tres resistencias de 10Ω, 20Ω y 30Ω en PARALELO, ¿cómo será la Resistencia Total (Req) comparada con la resistencia más pequeña (10Ω)?",
    options: [
      { id: "A", text: "Será de 60Ω porque las resistencias siempre se suman." },
      { id: "B", text: "Será MENOR a 10Ω (da aproximadamente 5.45Ω), porque abriste más caminos para la corriente." },
      { id: "C", text: "Será exactamente de 30Ω." },
      { id: "D", text: "Será infinita porque los electrones se marean con tantas opciones." }
    ],
    correctAnswer: "B",
    justification: {
      law: "Resistencia Equivalente en Paralelo (1/Req = 1/R1 + 1/R2 + 1/R3)",
      explanation: "Piensa en las cajas de cobro de un supermercado: si solo hay una caja abierta (10Ω), la gente avanza lento. Pero si abres dos cajas más (20Ω y 30Ω), la gente tiene MÁS CAMINOS para pasar, así que la congestión TOTAL disminuye. En paralelo, agregar ramas SIEMPRE reduce la resistencia total: 1/Req = 1/10 + 1/20 + 1/30 = 11/60 ➔ Req = 60/11 ≈ 5.45Ω (mucho menor que 10Ω).",
      formula: "\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3} \\implies R_{eq} < \\min(R_1, R_2, R_3)",
      realWorldTip: "Por eso en una autopista con 3 carriles fluyen más autos por minuto que en una de 1 carril, aunque los carriles nuevos sean más angostos."
    }
  },
  {
    id: 8,
    title: "Pregunta 8: La Ley de Nodos de Kirchhoff (LCK)",
    prompt: "A la unión de un cable (un Nodo) llegan 5 Amperios de corriente. Si el cable se divide en dos ramas y por la primera rama se van 2 Amperios, ¿cuántos Amperios se van OBLIGATORIAMENTE por la segunda rama?",
    options: [
      { id: "A", text: "Se van 3 Amperios (5A entrantes = 2A + 3A salientes)." },
      { id: "B", text: "Se van 7 Amperios porque la electricidad se multiplica." },
      { id: "C", text: "Se van 0 Amperios porque el nodo se traga los electrones." },
      { id: "D", text: "Se van 10 Amperios." }
    ],
    correctAnswer: "A",
    justification: {
      law: "Ley de Corrientes de Kirchhoff (LCK): Lo que entra tiene que salir",
      explanation: "Los electrones son partículas de materia física real: no pueden desaparecer en el aire ni crearse de la nada. Si por un tubo entran 5 litros de agua por segundo y por una manguera salen 2 litros/seg, por la otra manguera forzosamente tienen que salir los 3 litros/seg restantes: I_entra = I_sale1 + I_sale2 ➔ 5A = 2A + 3A.",
      formula: "\\sum I_{\\text{entrantes}} = \\sum I_{\\text{salientes}} \\implies 5\\text{A} - 2\\text{A} = 3\\text{A}",
      realWorldTip: "Es exactamente como el medidor de luz de tu casa: la corriente total que entra por el poste es la suma de los amperios que consumen todos los focos y enchufes prendidos al mismo tiempo."
    }
  },
  {
    id: 9,
    title: "Pregunta 9: ¿Qué pasa si se quema un foco? (Serie vs Paralelo)",
    prompt: "¿Por qué en las series navideñas antiguas si se quemaba un foquito se apagaba TODA la tira completa, mientras que en tu casa si se quema el foco de la cocina los demás focos siguen prendidos?",
    options: [
      { id: "A", text: "Porque las luces navideñas estaban en SERIE (un solo camino roto corta todo) y tu casa está en PARALELO (caminos independientes)." },
      { id: "B", text: "Porque la electricidad de la casa es más inteligente y esquiva el foco quemado." },
      { id: "C", text: "Porque los focos navideños son de plástico y los de la casa de vidrio." },
      { id: "D", text: "Porque en la casa el foco quemado produce más voltaje para los demás." }
    ],
    correctAnswer: "A",
    justification: {
      law: "Análisis de Falla de Circuito Abierto (Interruptor Abierto = Camino Roto)",
      explanation: "En SERIE hay un solo hilo continuo: si un foco se quema (se abre), el circuito se rompe como si cortaras el cable con una tijera y la corriente cae a CERO en todo el circuito. En PARALELO, cada foco tiene su propio camino directo a la batería: si la rama 2 se abre, la corriente en esa rama es 0A, pero las ramas 1 y 3 siguen teniendo su camino intacto y siguen funcionando normal.",
      formula: "\\text{Serie Abierto: } I_T = 0\\text{A} \\quad \\mid \\quad \\text{Paralelo Abierto: } I_T = I_1 + I_3",
      realWorldTip: "Puedes comprobarlo en nuestro simulador en la Zona 1: pon topología Paralelo y haz clic en 'ABRIR' en la Rama R2. Verás que R1 y R3 siguen brillando y con corriente."
    }
  },
  {
    id: 10,
    title: "Pregunta 10: ¿Qué es un Cortocircuito y por qué es peligroso? (Falla Crítica)",
    prompt: "Si unes directamente el cable positivo y el negativo de una batería con un alambre pelado de 0Ω (sin ningún foco o resistencia de por medio), ¿qué ocurre físicamente?",
    options: [
      { id: "A", text: "La resistencia es 0Ω, la corriente se dispara a niveles gigantescos (I → ∞) y el cable se sobrecalienta hasta incendiarse." },
      { id: "B", text: "La batería ahorra energía porque no hay nada que la gaste." },
      { id: "C", text: "El circuito se apaga suavemente y se enfría como un refrigerador." },
      { id: "D", text: "El voltaje de la batería se vuelve infinito y produce rayos." }
    ],
    correctAnswer: "A",
    justification: {
      law: "Cortocircuito (R = 0Ω) y Efecto Joule Destructivo (P = I² · R)",
      explanation: "Según la Ley de Ohm: Corriente = Voltaje / Resistencia (I = V / R). Si la resistencia R es casi CERO, estás dividiendo entre un número diminuto, lo que hace que los Amperios se disparen a cientos o miles de amperios. Al pasar tantos electrones apretados por el cable, el choque térmico (Efecto Joule: P = I² · R) genera tanto calor instantáneo que derrite el plástico, chispea y prende fuego.",
      formula: "I = \\lim_{R \\to 0} \\frac{V}{R} = \\infty \\implies P_{\\text{calor}} = I^2 \\cdot R \\quad (\\text{Fuego instantáneo})",
      realWorldTip: "Por esta razón todas las casas y carros tienen FUSIBLES y 'BREAKERS' (disyuntores termomagnéticos): son alambres calibrados que se rompen a propósito en milisegundos para cortar la corriente antes de que tu casa se incendie."
    }
  }
];
