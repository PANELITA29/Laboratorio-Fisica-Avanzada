export type Language = 'es' | 'en';

export interface Translations {
  brandTitle: string;
  brandSubtitle: string;
  authorBadge: string;
  navExplore: string;
  navFoundations: string;
  navArchitecture: string;
  navReports: string;
  statusOnline: string;
  statusOffline: string;
  installApp: string;
  installIOS: string;
  muteAudio: string;
  unmuteAudio: string;

  heroKicker: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroMotto: string;
  heroDescription: string;
  filterAll: string;
  filterCircuits: string;
  filterSpace: string;

  card1Category: string;
  card1Status: string;
  card1Title: string;
  card1Desc: string;
  card1Badges: string[];
  card1PlayBtn: string;
  card1ObjectivesBtn: string;
  card1ObjectivesTitle: string;
  card1ObjectivesList: string[];

  card2Category: string;
  card2Status: string;
  card2Title: string;
  card2Desc: string;
  card2Badges: string[];
  card2PlayBtn: string;
  card2ObjectivesBtn: string;
  card2ObjectivesTitle: string;
  card2ObjectivesList: string[];

  backToHub: string;
  generateReport: string;
  challengesTab: string;
  sandboxTab: string;
  resetSim: string;
  pauseSim: string;
  resumeSim: string;

  circuitTitle: string;
  circuitSubtitle: string;
  toolboxTitle: string;
  compBattery: string;
  compResistor: string;
  compBulb: string;
  compSwitch: string;
  compWire: string;
  compBlackBox: string;
  flowModeLabel: string;
  flowElectrons: string;
  flowConventional: string;
  presetsTitle: string;
  presetOhm: string;
  presetDivider: string;
  presetParallel: string;
  presetBlackBox: string;
  selectedCompTitle: string;
  voltageLabel: string;
  resistanceLabel: string;
  maxPowerLabel: string;
  invertPolarity: string;
  toggleSwitch: string;
  deleteComp: string;
  clearBoard: string;
  multimeterTitle: string;
  ammeterTitle: string;
  ohmGraphTitle: string;
  ohmGraphSubtitle: string;
  recordDataPoint: string;
  clearGraphData: string;
  burnoutWarning: string;

  spaceTitle: string;
  spaceSubtitle: string;
  cameraModeLabel: string;
  camFree: string;
  camChase: string;
  camSurface: string;
  chaseTargetLabel: string;
  presetSolar: string;
  presetEarthMoon: string;
  presetExoplanet: string;
  presetGeostationary: string;
  presetLagrange: string;
  layersLabel: string;
  layerSpacetime: string;
  layerGravityVec: string;
  layerVelocityVec: string;
  layerTrails: string;
  insertionVelocityLabel: string;
  gravityConstantLabel: string;
  timeStepLabel: string;
  hideControls: string;
  showControls: string;

  challengesHeader: string;
  validateChallenge: string;
  loadChallengeSetup: string;
  challengeCompleted: string;
  challengePending: string;
  scoreLabel: string;

  reportModalTitle: string;
  reportModalSubtitle: string;
  reportStudentLabel: string;
  reportLabTypeLabel: string;
  reportQuestionLabel: string;
  reportQuestionPlaceholder: string;
  reportHypothesisLabel: string;
  reportHypothesisPlaceholder: string;
  reportVariablesLabel: string;
  reportVariablesPlaceholder: string;
  reportResultsLabel: string;
  reportResultsPlaceholder: string;
  reportTelemetryTitle: string;
  reportPrintBtn: string;
  reportCloseBtn: string;

  archTitle: string;
  archSubtitle: string;
  gitTitle: string;
  gitSubtitle: string;
  foundationsTitle: string;
  foundationsSubtitle: string;
}

export const dictionary: Record<Language, Translations> = {
  es: {
    brandTitle: 'LabFísica Avanzada',
    brandSubtitle: 'Instrumentación y Simulación Numérica',
    authorBadge: 'Investigador: Juan David González Alarcón',
    navExplore: 'Módulos',
    navFoundations: 'Ecuaciones',
    navArchitecture: 'Arquitectura',
    navReports: 'Informe',
    statusOnline: 'Red activa',
    statusOffline: 'Modo local PWA',
    installApp: 'Instalar PWA',
    installIOS: 'Instalar en iOS',
    muteAudio: 'Silenciar 60Hz',
    unmuteAudio: 'Activar 60Hz',

    heroKicker: 'SIMULACIÓN NUMÉRICA DETERMINISTA · WEBGL / CANVAS',
    heroTitleLine1: 'Laboratorio de Física y Química Computacional',
    heroTitleLine2: 'Electrodinámica, Gravitación, Oscilaciones, Balística y Química 3D',
    heroMotto: 'Resolución analítica en tiempo real mediante Leyes de Kirchhoff, Velocity Verlet, Runge-Kutta 4 y PV=nRT.',
    heroDescription:
      'Cinco bancos de prueba interactivos sin aproximaciones pregrabadas: análisis nodal DC con efectos térmicos Joule, dinámica orbital N-cuerpos, péndulos acoplados 3D, balística 2D y reactor estequiométrico / gases ideales 3D.',
    filterAll: 'Todos (5)',
    filterCircuits: 'Electrodinámica DC',
    filterSpace: 'Mecánica Celeste',

    card1Category: 'MÓDULO 01 · ELECTRODINÁMICA DC',
    card1Status: 'SOLVER NODAL MATRICIAL',
    card1Title: 'Banco de Circuitos DC y Leyes de Kirchhoff',
    card1Desc:
      'Resolución exacta de mallas en serie, paralelo y mixtas (R₁ + R₂∥R₃). Incluye multímetro digital de tres modos (V⎓, Ω, A⎓), código EIA de 4/5 bandas, régimen transitorio RC y ruptura térmica a 15 W.',
    card1Badges: ['Ohm & Kirchhoff', 'IEC 60062', 'Transitorio RC'],
    card1PlayBtn: 'Abrir Banco DC',
    card1ObjectivesBtn: 'Especificaciones y Objetivos',
    card1ObjectivesTitle: 'Objetivos Técnicos — Electrodinámica DC',
    card1ObjectivesList: [
      'Verificar la relación lineal V = I · R mediante muestreo experimental y regresión por mínimos cuadrados.',
      'Comprobar conservación de carga (LCK: ∑ I_ent = ∑ I_sal) y energía (LVK: ∑ ΔV = 0) por nodo y malla.',
      'Decodificar resistores de 4 y 5 bandas bajo norma IEC 60062 y diagnosticar fallas de circuito abierto o cortocircuito.',
      'Medir disipación térmica P = I² · R y observar la fusión del filamento al superar 15.0 W.',
    ],

    card2Category: 'MÓDULO 02 · ASTROFÍSICA N-CUERPOS',
    card2Status: 'INTEGRADOR VELOCITY VERLET',
    card2Title: 'Gravitación N-Cuerpos y Geodésicas 3D',
    card2Desc:
      'Integración simpléctica de segundo orden que conserva el momento angular. Calcula perihelio, afelio, excentricidad, velocidad de escape (v_e = √2·v_c) y órbitas de transferencia de Hohmann.',
    card2Badges: ['Velocity Verlet', 'Leyes de Kepler', 'GLSL Shader'],
    card2PlayBtn: 'Abrir Simulador Orbital',
    card2ObjectivesBtn: 'Especificaciones y Objetivos',
    card2ObjectivesTitle: 'Objetivos Técnicos — Mecánica Celeste',
    card2ObjectivesList: [
      'Evaluar la deformación del potencial gravitatorio z(x,y) = -∑ G·Mᵢ / √(r² + ε²) sobre la malla GLSL.',
      'Cuantificar excentricidad orbital, velocidades en perihelio/afelio (2ª Ley) y período T² = a³/M (3ª Ley).',
      'Inyectar impulsos Δv₁ para ejecutar transferencias elípticas de Hohmann entre órbitas coplanares.',
      'Contrastar vectores de fuerza centrípeta y velocidad tangencial desde cámaras libres, de seguimiento y superficiales.',
    ],

    backToHub: 'Índice de Módulos',
    generateReport: 'Exportar Informe',
    challengesTab: 'Prácticas Guiadas',
    sandboxTab: 'Banco Libre',
    resetSim: 'Reiniciar',
    pauseSim: 'Pausar',
    resumeSim: 'Reanudar',

    circuitTitle: 'Banco de Electrodinámica DC',
    circuitSubtitle: 'Análisis Nodal Kirchhoff · Normativa EIA 4/5 Bandas · Multímetro V⎓ / Ω / A⎓',
    toolboxTitle: 'Componentes',
    compBattery: 'Fuente DC (0–48 V)',
    compResistor: 'Resistor EIA',
    compBulb: 'Bombilla',
    compSwitch: 'Interruptor SPST',
    compWire: 'Conductor',
    compBlackBox: 'Resistencia Incógnita R_x',
    flowModeLabel: 'Portadores',
    flowElectrons: 'Electrones (e⁻)',
    flowConventional: 'Convencional (I)',
    presetsTitle: 'Topologías Base',
    presetOhm: 'Lazo Simple',
    presetDivider: 'Divisor de Tensión (Reto 1)',
    presetParallel: 'Ramas en Paralelo',
    presetBlackBox: 'Incógnita Caja Negra (Reto 2)',
    selectedCompTitle: 'Parámetros del Componente',
    voltageLabel: 'Tensión Nominal (V)',
    resistanceLabel: 'Resistencia (Ω)',
    maxPowerLabel: 'Potencia Límite (W)',
    invertPolarity: 'Invertir Polaridad (+/-)',
    toggleSwitch: 'Conmutar Estado',
    deleteComp: 'Retirar Componente',
    clearBoard: 'Reiniciar Banco',
    multimeterTitle: 'Multímetro Digital',
    ammeterTitle: 'Amperímetro Serie',
    ohmGraphTitle: 'Curva V vs. I y Regresión Lineal',
    ohmGraphSubtitle: 'Pendiente experimental R_exp = ΔV / ΔI',
    recordDataPoint: 'Capturar Muestra (V, I)',
    clearGraphData: 'Limpiar Muestras',
    burnoutWarning: 'Límite térmico superado (> 15.0 W): filamento abierto.',

    spaceTitle: 'Simulador de Mecánica Celeste 3D',
    spaceSubtitle: 'Integrador Simpléctico Velocity Verlet · Leyes de Kepler · Malla Potencial GLSL',
    cameraModeLabel: 'Cámara',
    camFree: 'Orbital Libre',
    camChase: 'Seguimiento',
    camSurface: 'Superficial',
    chaseTargetLabel: 'Objetivo',
    presetSolar: 'Sol - Tierra - Marte',
    presetEarthMoon: 'Tierra - Luna - Satélite',
    presetExoplanet: 'Tránsito Exoplanetario',
    presetGeostationary: 'Órbita Geoestacionaria (Reto 1)',
    presetLagrange: 'Coreografía 3 Cuerpos (Reto 2)',
    layersLabel: 'Capas',
    layerSpacetime: 'Potencial Gravitatorio',
    layerGravityVec: 'Vector Fuerza (Fg)',
    layerVelocityVec: 'Vector Velocidad (v)',
    layerTrails: 'Trazas Orbitales',
    insertionVelocityLabel: 'Velocidad Inserción',
    gravityConstantLabel: 'Constante G',
    timeStepLabel: 'Paso Temporal',
    hideControls: 'Ocultar Panel',
    showControls: 'Mostrar Panel',

    challengesHeader: 'Protocolos de Verificación Experimental',
    validateChallenge: 'Verificar Condiciones',
    loadChallengeSetup: 'Cargar Configuración',
    challengeCompleted: 'Verificado',
    challengePending: 'Pendiente',
    scoreLabel: 'Prácticas',

    reportModalTitle: 'Informe Técnico de Laboratorio',
    reportModalSubtitle: 'Registro experimental con telemetría capturada del banco activo',
    reportStudentLabel: 'Autor / Investigador',
    reportLabTypeLabel: 'Módulo Experimental',
    reportQuestionLabel: '1. Problema de Investigación',
    reportQuestionPlaceholder: 'Ej: Relación entre caída de tensión y corriente en ramas paralelas.',
    reportHypothesisLabel: '2. Hipótesis de Trabajo',
    reportHypothesisPlaceholder: 'Ej: La corriente total iguala la suma algebraica de las corrientes de rama.',
    reportVariablesLabel: '3. Variables Experimentalmente Controladas',
    reportVariablesPlaceholder: 'Ej: Independiente: Tensión V_F (V). Dependiente: Corriente I_T (A).',
    reportResultsLabel: '4. Resultados y Margen de Error',
    reportResultsPlaceholder: 'Ej: Pendiente lineal R_eq verificada con desviación inferior a 0.1%.',
    reportTelemetryTitle: '5. Telemetría Capturada del Instrumento',
    reportPrintBtn: 'Imprimir / Guardar PDF',
    reportCloseBtn: 'Cerrar',

    archTitle: 'Arquitectura del Motor Numérico',
    archSubtitle: 'Desacoplamiento entre solucionadores matemáticos puros y vistas WebGL/Canvas',
    gitTitle: 'Control de Versiones y Despliegue',
    gitSubtitle: 'Flujo de trabajo hacia GitHub y Vercel',
    foundationsTitle: 'Formulaciones Físico-Matemáticas',
    foundationsSubtitle: 'Ecuaciones diferenciales y algebraicas ejecutadas en cada fotograma',
  },
  en: {
    brandTitle: 'AdvPhysics Lab',
    brandSubtitle: 'Numerical Simulation & Instrumentation',
    authorBadge: 'Researcher: Juan David González Alarcón',
    navExplore: 'Modules',
    navFoundations: 'Equations',
    navArchitecture: 'Architecture',
    navReports: 'Report',
    statusOnline: 'Network active',
    statusOffline: 'Local PWA mode',
    installApp: 'Install PWA',
    installIOS: 'Install on iOS',
    muteAudio: 'Mute 60Hz',
    unmuteAudio: 'Enable 60Hz',

    heroKicker: 'DETERMINISTIC NUMERICAL SIMULATION · WEBGL / CANVAS',
    heroTitleLine1: 'Computational Physics & Chemistry Laboratory',
    heroTitleLine2: 'Electrodynamics, Gravitation, Oscillations, Ballistics & 3D Chemistry',
    heroMotto: 'Real-time analytical solving via Kirchhoff Nodal Analysis, Velocity Verlet, 4th-Order Runge-Kutta & PV=nRT.',
    heroDescription:
      'Five interactive testbenches without pre-baked animations: DC nodal analysis with Joule thermal limits, N-body orbital dynamics, 3D coupled pendulums, 2D ballistics, and 3D stoichiometric reactor / ideal gases.',
    filterAll: 'All (5)',
    filterCircuits: 'DC Electrodynamics',
    filterSpace: 'Celestial Mechanics',

    card1Category: 'MODULE 01 · DC ELECTRODINAMICS',
    card1Status: 'NODAL MATRIX SOLVER',
    card1Title: 'DC Circuit Workbench & Kirchhoff Laws',
    card1Desc:
      'Exact solving for series, parallel, and mixed (R₁ + R₂∥R₃) topologies. Features a three-mode digital multimeter (V⎓, Ω, A⎓), 4/5-band EIA color coding, RC transient state, and 15 W thermal fusing.',
    card1Badges: ['Ohm & Kirchhoff', 'IEC 60062', 'RC Transient'],
    card1PlayBtn: 'Open DC Workbench',
    card1ObjectivesBtn: 'Specifications & Objectives',
    card1ObjectivesTitle: 'Technical Objectives — DC Electrodynamics',
    card1ObjectivesList: [
      'Verify the linear V = I · R relation via experimental sampling and least-squares regression.',
      'Confirm charge conservation (KCL: ∑ I_in = ∑ I_out) and energy conservation (KVL: ∑ ΔV = 0) per node and loop.',
      'Decode 4- and 5-band resistors under IEC 60062 and diagnose open-circuit or short-circuit faults.',
      'Measure Joule thermal dissipation P = I² · R and observe filament fusing above 15.0 W.',
    ],

    card2Category: 'MODULE 02 · N-BODY ASTROPHYSICS',
    card2Status: 'VELOCITY VERLET INTEGRATOR',
    card2Title: 'N-Body Gravitation & 3D Geodesics',
    card2Desc:
      'Second-order symplectic integration conserving angular momentum. Computes perihelion, aphelion, eccentricity, escape velocity (v_e = √2·v_c), and Hohmann transfer orbits.',
    card2Badges: ['Velocity Verlet', 'Kepler Laws', 'GLSL Shader'],
    card2PlayBtn: 'Open Orbital Simulator',
    card2ObjectivesBtn: 'Specifications & Objectives',
    card2ObjectivesTitle: 'Technical Objectives — Celestial Mechanics',
    card2ObjectivesList: [
      'Evaluate gravitational potential deformation z(x,y) = -∑ G·Mᵢ / √(r² + ε²) on the GLSL vertex mesh.',
      'Quantify orbital eccentricity, perihelion/aphelion speeds (2nd Law), and period T² = a³/M (3rd Law).',
      'Inject Δv₁ impulses to execute Hohmann elliptical transfers between coplanar orbits.',
      'Inspect centripetal force and tangential velocity vectors across free, chase, and surface cameras.',
    ],

    backToHub: 'Module Index',
    generateReport: 'Export Report',
    challengesTab: 'Guided Labs',
    sandboxTab: 'Free Workbench',
    resetSim: 'Reset',
    pauseSim: 'Pause',
    resumeSim: 'Resume',

    circuitTitle: 'DC Electrodynamics Workbench',
    circuitSubtitle: 'Kirchhoff Nodal Analysis · 4/5-Band EIA Standard · V⎓ / Ω / A⎓ Multimeter',
    toolboxTitle: 'Components',
    compBattery: 'DC Source (0–48 V)',
    compResistor: 'EIA Resistor',
    compBulb: 'Bulb',
    compSwitch: 'SPST Switch',
    compWire: 'Conductor',
    compBlackBox: 'Unknown Resistor R_x',
    flowModeLabel: 'Carriers',
    flowElectrons: 'Electrons (e⁻)',
    flowConventional: 'Conventional (I)',
    presetsTitle: 'Reference Topologies',
    presetOhm: 'Single Loop',
    presetDivider: 'Voltage Divider (Lab 1)',
    presetParallel: 'Parallel Branches',
    presetBlackBox: 'Unknown Black Box (Lab 2)',
    selectedCompTitle: 'Component Parameters',
    voltageLabel: 'Nominal Voltage (V)',
    resistanceLabel: 'Resistance (Ω)',
    maxPowerLabel: 'Power Rating (W)',
    invertPolarity: 'Invert Polarity (+/-)',
    toggleSwitch: 'Toggle State',
    deleteComp: 'Remove Component',
    clearBoard: 'Reset Workbench',
    multimeterTitle: 'Digital Multimeter',
    ammeterTitle: 'Series Ammeter',
    ohmGraphTitle: 'V vs. I Curve & Linear Regression',
    ohmGraphSubtitle: 'Experimental slope R_exp = ΔV / ΔI',
    recordDataPoint: 'Capture Sample (V, I)',
    clearGraphData: 'Clear Samples',
    burnoutWarning: 'Thermal limit exceeded (> 15.0 W): open filament.',

    spaceTitle: '3D Celestial Mechanics Simulator',
    spaceSubtitle: 'Symplectic Velocity Verlet Integrator · Kepler Laws · GLSL Potential Mesh',
    cameraModeLabel: 'Camera',
    camFree: 'Free Orbit',
    camChase: 'Chase',
    camSurface: 'Surface',
    chaseTargetLabel: 'Target',
    presetSolar: 'Sun - Earth - Mars',
    presetEarthMoon: 'Earth - Moon - Satellite',
    presetExoplanet: 'Exoplanet Transit',
    presetGeostationary: 'Geostationary Orbit (Lab 1)',
    presetLagrange: '3-Body Choreography (Lab 2)',
    layersLabel: 'Layers',
    layerSpacetime: 'Gravitational Potential',
    layerGravityVec: 'Force Vector (Fg)',
    layerVelocityVec: 'Velocity Vector (v)',
    layerTrails: 'Orbital Trails',
    insertionVelocityLabel: 'Insertion Velocity',
    gravityConstantLabel: 'Constant G',
    timeStepLabel: 'Time Step',
    hideControls: 'Hide Panel',
    showControls: 'Show Panel',

    challengesHeader: 'Experimental Verification Protocols',
    validateChallenge: 'Verify Conditions',
    loadChallengeSetup: 'Load Setup',
    challengeCompleted: 'Verified',
    challengePending: 'Pending',
    scoreLabel: 'Completed',

    reportModalTitle: 'Technical Laboratory Report',
    reportModalSubtitle: 'Experimental log with live telemetry from the active workbench',
    reportStudentLabel: 'Author / Researcher',
    reportLabTypeLabel: 'Experimental Module',
    reportQuestionLabel: '1. Research Problem',
    reportQuestionPlaceholder: 'E.g., Voltage drop and current distribution across parallel branches.',
    reportHypothesisLabel: '2. Working Hypothesis',
    reportHypothesisPlaceholder: 'E.g., Total current equals the algebraic sum of branch currents.',
    reportVariablesLabel: '3. Controlled Variables',
    reportVariablesPlaceholder: 'E.g., Independent: Source voltage V_F (V). Dependent: Current I_T (A).',
    reportResultsLabel: '4. Results & Error Margin',
    reportResultsPlaceholder: 'E.g., Linear slope R_eq verified within 0.1% error.',
    reportTelemetryTitle: '5. Captured Instrument Telemetry',
    reportPrintBtn: 'Print / Save PDF',
    reportCloseBtn: 'Close',

    archTitle: 'Numerical Engine Architecture',
    archSubtitle: 'Strict decoupling between pure mathematical solvers and WebGL/Canvas views',
    gitTitle: 'Version Control & Deployment',
    gitSubtitle: 'GitHub and Vercel workflow',
    foundationsTitle: 'Mathematical Formulations',
    foundationsSubtitle: 'Differential and algebraic equations evaluated per frame',
  },
};
