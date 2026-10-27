export type Language = 'es' | 'en';

export interface Translations {
  // Header & Nav
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

  // Hero
  heroKicker: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroMotto: string;
  heroDescription: string;
  filterAll: string;
  filterCircuits: string;
  filterSpace: string;

  // Cards
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

  // Common Lab Controls
  backToHub: string;
  generateReport: string;
  challengesTab: string;
  sandboxTab: string;
  resetSim: string;
  pauseSim: string;
  resumeSim: string;

  // Circuit Lab
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

  // Space Lab
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

  // Challenges
  challengesHeader: string;
  validateChallenge: string;
  loadChallengeSetup: string;
  challengeCompleted: string;
  challengePending: string;
  scoreLabel: string;

  // Scientific Report Modal
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

  // Architecture & Git Guide
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
    brandSubtitle: 'Suite de Simulación Científica · PhET Formula',
    authorBadge: 'Proyecto de Investigación Científica | Investigador: Juan David González Alarcón',
    navExplore: 'Laboratorios',
    navFoundations: 'Fundamentos',
    navArchitecture: 'Arquitectura y Git',
    navReports: 'Informe Científico',
    statusOnline: 'Offline Ready · En Línea',
    statusOffline: 'Modo Offline Activo (PWA)',
    installApp: 'Instalar App',
    installIOS: 'Instalar en iOS',
    muteAudio: 'Silenciar Audio',
    unmuteAudio: 'Activar Audio',

    heroKicker: 'PLATAFORMA DE EXPERIMENTACIÓN VIRTUAL 2D Y 3D',
    heroTitleLine1: 'Simuladores Interactivos de',
    heroTitleLine2: 'Física, Electrodinámica y Astronomía',
    heroMotto: 'Experimenta, formula hipótesis y descubre las leyes fundamentales del cosmos',
    heroDescription:
      'Suite interactiva con solucionador determinista de mallas por Leyes de Kirchhoff, gravitación N-Cuerpos mediante integración simpléctica de Velocity Verlet y malla relativista de espacio-tiempo en WebGL.',
    filterAll: 'Todos los Laboratorios (2)',
    filterCircuits: 'Física y Electricidad (1)',
    filterSpace: 'Astronomía y Espacio 3D (1)',

    card1Category: 'FÍSICA Y ELECTRICIDAD · TIEMPO REAL',
    card1Status: '60 FPS · INTERACTIVO 2D',
    card1Title: 'Kit de Construcción de Circuitos DC',
    card1Desc:
      'Laboratorio de electrodinámica con resolución matricial nodal (Ohm y Kirchhoff), código de colores de 4 bandas en tiempo real, flujo dual de electrones/corriente convencional, multímetro flotante y gráfica V vs. I en vivo.',
    card1Badges: ['Física Eléctrica', 'Tiempo Real', 'Nivel: Secundaria / Universitario'],
    card1PlayBtn: 'Iniciar Laboratorio DC',
    card1ObjectivesBtn: 'Ver Objetivos de Aprendizaje',
    card1ObjectivesTitle: 'Objetivos Pedagógicos — Circuitos DC',
    card1ObjectivesList: [
      'Comprender y verificar experimentalmente la Ley de Ohm (V = I · R) mediante regresión lineal.',
      'Analizar divisores de tensión y conservación de carga/energía con las Leyes de Kirchhoff (KCL y KVL).',
      'Identificar resistencias mediante el estándar internacional de código de colores de 4 bandas (IEC 60062).',
      'Evaluar la potencia eléctrica disipada (P = I² · R) y los límites térmicos de componentes reales.',
    ],

    card2Category: 'ASTRONOMÍA 3D · WEBGL / THREE.JS',
    card2Status: '60 FPS · MOTOR VERLET 3D',
    card2Title: 'Laboratorio de Gravedad, Órbitas y Espacio-Tiempo 3D',
    card2Desc:
      'Simulador astrofísico N-Cuerpos con integración numérica de Velocity Verlet, deformación relativista del espacio-tiempo de Einstein en tiempo real, cinemática de cámaras (Orbital, Seguimiento, Superficial) y vectores 3D.',
    card2Badges: ['Astronomía 3D', 'WebGL / Three.js', 'Gravitación Universal'],
    card2PlayBtn: 'Iniciar Simulación 3D',
    card2ObjectivesBtn: 'Ver Objetivos de Aprendizaje',
    card2ObjectivesTitle: 'Objetivos Pedagógicos — Gravitación y Espacio-Tiempo',
    card2ObjectivesList: [
      'Visualizar la curvatura del tejido espacio-temporal descrita por la Relatividad General de Einstein.',
      'Experimentar con velocidades de inserción orbital, órbitas circulares, elípticas y velocidad de escape.',
      'Analizar vectores de fuerza gravitacional centrípeta y velocidad tangencial en marcos de referencia móviles.',
      'Estudiar la estabilidad orbital de múltiples cuerpos y puntos de equilibrio de Lagrange con integradores simplécticos.',
    ],

    backToHub: 'Volver al Hub Central',
    generateReport: 'Generar Reporte Científico',
    challengesTab: 'Desafíos Experimentales',
    sandboxTab: 'Laboratorio Libre',
    resetSim: 'Reiniciar',
    pauseSim: 'Pausar',
    resumeSim: 'Reanudar',

    circuitTitle: 'Laboratorio de Circuitos Eléctricos DC',
    circuitSubtitle: 'Solucionador de Mallas (Ohm y Kirchhoff) · Código de 4 Bandas · Instrumentación Digital',
    toolboxTitle: 'Caja de Componentes',
    compBattery: 'Fuente DC (Batería)',
    compResistor: 'Resistencia 4 Bandas',
    compBulb: 'Bombilla Incandescente',
    compSwitch: 'Interruptor SPST',
    compWire: 'Cable Conductor',
    compBlackBox: 'Caja Negra (Incógnita)',
    flowModeLabel: 'Visualización de Corriente',
    flowElectrons: 'Flujo de Electrones (e⁻)',
    flowConventional: 'Corriente Convencional (I)',
    presetsTitle: 'Circuitos de Referencia',
    presetOhm: 'Ley de Ohm Clásica',
    presetDivider: 'Divisor de Tensión (Reto 1)',
    presetParallel: 'Ramas en Paralelo',
    presetBlackBox: 'Incógnita Caja Negra (Reto 2)',
    selectedCompTitle: 'Inspector de Componente',
    voltageLabel: 'Voltaje Nominal (V)',
    resistanceLabel: 'Resistencia Eléctrica (Ω)',
    maxPowerLabel: 'Potencia Máxima Nominal (W)',
    invertPolarity: 'Invertir Polaridad (+/-)',
    toggleSwitch: 'Conmutar Interruptor',
    deleteComp: 'Eliminar Componente',
    clearBoard: 'Limpiar Mesa',
    multimeterTitle: 'Multímetro Digital Flotante',
    ammeterTitle: 'Amperímetro de Pinza',
    ohmGraphTitle: 'Gráfica en Vivo: Voltaje vs. Corriente (Ley de Ohm)',
    ohmGraphSubtitle: 'Pendiente de regresión experimental R = ΔV / ΔI',
    recordDataPoint: 'Registrar Punto (V, I)',
    clearGraphData: 'Limpiar Gráfica',
    burnoutWarning: '¡Sobrecarga Térmica! Potencia excedida (Filamento fundido)',

    spaceTitle: 'Laboratorio Espacial y Relativista 3D',
    spaceSubtitle: 'Gravitación Universal N-Cuerpos · Integrador Velocity Verlet · Deformación Espacio-Temporal',
    cameraModeLabel: 'Cinemática de Cámara',
    camFree: 'Orbital Libre',
    camChase: 'Seguimiento (Chase)',
    camSurface: 'Superficial (Tránsito)',
    chaseTargetLabel: 'Cuerpo Objetivo',
    presetSolar: 'Sol - Tierra - Marte',
    presetEarthMoon: 'Sistema Tierra - Luna - Satélite',
    presetExoplanet: 'Tránsito de Exoplaneta',
    presetGeostationary: 'Órbita Geoestacionaria (Reto 1)',
    presetLagrange: 'Coreografía 3 Cuerpos (Reto 2)',
    layersLabel: 'Capas Físicas',
    layerSpacetime: 'Malla Espacio-Tiempo',
    layerGravityVec: 'Vectores Fuerza (Fg)',
    layerVelocityVec: 'Vectores Velocidad (v)',
    layerTrails: 'Rastro Orbital',
    insertionVelocityLabel: 'Factor Velocidad de Inserción',
    gravityConstantLabel: 'Escala Gravitacional (G)',
    timeStepLabel: 'Velocidad de Simulación',
    hideControls: 'Ocultar Controles (Modo Zen)',
    showControls: 'Mostrar Controles de Laboratorio',

    challengesHeader: 'Misiones y Desafíos Experimentales de Feria Científica',
    validateChallenge: 'Validar Experimento Ahora',
    loadChallengeSetup: 'Cargar Montaje Base',
    challengeCompleted: '¡Reto Superado!',
    challengePending: 'Pendiente de Validación',
    scoreLabel: 'Puntuación Científica',

    reportModalTitle: 'Generador de Informes Científicos Oficiales',
    reportModalSubtitle: 'Documentación estructurada bajo el Método Científico con telemetría capturada en tiempo real',
    reportStudentLabel: 'Investigador Principal',
    reportLabTypeLabel: 'Módulo Experimental Activo',
    reportQuestionLabel: '1. Pregunta de Investigación',
    reportQuestionPlaceholder: 'Ej: ¿Cómo varía la intensidad de corriente eléctrica en función de la diferencia de potencial aplicada en un conductor óhmico?',
    reportHypothesisLabel: '2. Hipótesis Formulada',
    reportHypothesisPlaceholder: 'Ej: Si la resistencia del circuito permanece constante, la corriente eléctrica será directamente proporcional al voltaje aplicado (V = I · R).',
    reportVariablesLabel: '3. Variables Controladas, Independiente y Dependiente',
    reportVariablesPlaceholder: 'Ej: Independiente: Voltaje de la batería (V). Dependiente: Corriente medida (A). Controlada: Resistencia eléctrica fija (Ω).',
    reportResultsLabel: '4. Análisis de Resultados y Conclusiones',
    reportResultsPlaceholder: 'Ej: Los datos experimentales confirman una pendiente lineal constante con error relativo menor al 0.1%, validando la Ley de Ohm...',
    reportTelemetryTitle: '5. Telemetría Experimental Extraída Automáticamente del Lienzo',
    reportPrintBtn: 'Exportar a PDF / Imprimir Formato Científico',
    reportCloseBtn: 'Cerrar Informe',

    archTitle: 'Arquitectura Modular y Estructura del Proyecto',
    archSubtitle: 'Separación estricta de responsabilidades física-matemática, renderizado WebGL/Canvas y capa pedagógica',
    gitTitle: 'Guía de Despliegue Git y Vercel',
    gitSubtitle: 'Comandos exactos para actualizar el repositorio Laboratorio-Fisica-Avanzada y verificar en producción',
    foundationsTitle: 'Fundamentos Físico-Matemáticos del Motor',
    foundationsSubtitle: 'Modelos numéricos implementados para garantizar estabilidad y fidelidad física a 60 FPS',
  },
  en: {
    brandTitle: 'AdvPhysics Lab',
    brandSubtitle: 'Scientific Simulation Suite · PhET Formula',
    authorBadge: 'Scientific Research Project | Lead Researcher: Juan David González Alarcón',
    navExplore: 'Laboratories',
    navFoundations: 'Foundations',
    navArchitecture: 'Architecture & Git',
    navReports: 'Scientific Report',
    statusOnline: 'Offline Ready · Online',
    statusOffline: 'Offline Mode Active (PWA)',
    installApp: 'Install App',
    installIOS: 'Install on iOS',
    muteAudio: 'Mute Audio',
    unmuteAudio: 'Unmute Audio',

    heroKicker: '2D & 3D VIRTUAL EXPERIMENTATION PLATFORM',
    heroTitleLine1: 'Interactive Simulators for',
    heroTitleLine2: 'Physics, Electrodynamics & Astronomy',
    heroMotto: 'Experiment, formulate hypotheses, and discover the fundamental laws of the cosmos',
    heroDescription:
      'Interactive simulation suite featuring a deterministic Kirchhoff nodal mesh solver, N-Body gravitation via symplectic Velocity Verlet integration, and relativistic spacetime curvature in WebGL.',
    filterAll: 'All Laboratories (2)',
    filterCircuits: 'Physics & Electricity (1)',
    filterSpace: 'Astronomy & 3D Space (1)',

    card1Category: 'ELECTRICAL PHYSICS · REAL TIME',
    card1Status: '60 FPS · 2D INTERACTIVE',
    card1Title: 'DC Circuit Construction Kit',
    card1Desc:
      'Electrodynamics laboratory with nodal matrix solver (Ohm & Kirchhoff laws), real-time 4-band resistor color code, dual electron/conventional current flow, draggable multimeter, and live V vs. I regression chart.',
    card1Badges: ['Electrical Physics', 'Real-Time', 'Level: High School / University'],
    card1PlayBtn: 'Launch DC Lab',
    card1ObjectivesBtn: 'View Learning Objectives',
    card1ObjectivesTitle: 'Learning Objectives — DC Circuits',
    card1ObjectivesList: [
      'Understand and experimentally verify Ohm’s Law (V = I · R) through linear regression.',
      'Analyze voltage dividers and charge/energy conservation using Kirchhoff’s Laws (KCL & KVL).',
      'Identify resistor values using the international 4-band color code standard (IEC 60062).',
      'Evaluate dissipated electrical power (P = I² · R) and thermal limits of real components.',
    ],

    card2Category: '3D ASTRONOMY · WEBGL / THREE.JS',
    card2Status: '60 FPS · 3D VERLET ENGINE',
    card2Title: 'Gravity, Orbits & 3D Spacetime Laboratory',
    card2Desc:
      'N-Body astrophysical simulator with Velocity Verlet numerical integration, real-time Einsteinian spacetime fabric deformation, dynamic camera kinematics (Free Orbit, Chase, Surface), and 3D force/velocity vectors.',
    card2Badges: ['3D Astronomy', 'WebGL / Three.js', 'Universal Gravitation'],
    card2PlayBtn: 'Launch 3D Simulation',
    card2ObjectivesBtn: 'View Learning Objectives',
    card2ObjectivesTitle: 'Learning Objectives — Gravitation & Spacetime',
    card2ObjectivesList: [
      'Visualize spacetime fabric curvature as described by Einstein’s General Relativity.',
      'Experiment with orbital insertion velocities, circular/elliptical orbits, and escape velocity.',
      'Analyze centripetal gravitational force and tangential velocity vectors in moving reference frames.',
      'Study multi-body orbital stability and Lagrangian equilibrium points with symplectic integrators.',
    ],

    backToHub: 'Back to Central Hub',
    generateReport: 'Generate Scientific Report',
    challengesTab: 'Experimental Challenges',
    sandboxTab: 'Free Sandbox',
    resetSim: 'Reset',
    pauseSim: 'Pause',
    resumeSim: 'Resume',

    circuitTitle: 'DC Electrical Circuits Laboratory',
    circuitSubtitle: 'Mesh Solver (Ohm & Kirchhoff) · 4-Band Color Code · Digital Instrumentation',
    toolboxTitle: 'Component Toolbox',
    compBattery: 'DC Source (Battery)',
    compResistor: '4-Band Resistor',
    compBulb: 'Incandescent Bulb',
    compSwitch: 'SPST Switch',
    compWire: 'Conductor Wire',
    compBlackBox: 'Black Box (Unknown R)',
    flowModeLabel: 'Current Visualization',
    flowElectrons: 'Electron Flow (e⁻)',
    flowConventional: 'Conventional Current (I)',
    presetsTitle: 'Reference Circuits',
    presetOhm: 'Classic Ohm’s Law',
    presetDivider: 'Voltage Divider (Challenge 1)',
    presetParallel: 'Parallel Branches',
    presetBlackBox: 'Black Box Unknown (Challenge 2)',
    selectedCompTitle: 'Component Inspector',
    voltageLabel: 'Nominal Voltage (V)',
    resistanceLabel: 'Electrical Resistance (Ω)',
    maxPowerLabel: 'Max Rated Power (W)',
    invertPolarity: 'Invert Polarity (+/-)',
    toggleSwitch: 'Toggle Switch',
    deleteComp: 'Delete Component',
    clearBoard: 'Clear Workbench',
    multimeterTitle: 'Floating Digital Multimeter',
    ammeterTitle: 'Clamp Ammeter',
    ohmGraphTitle: 'Live Graph: Voltage vs. Current (Ohm’s Law)',
    ohmGraphSubtitle: 'Experimental regression slope R = ΔV / ΔI',
    recordDataPoint: 'Record Point (V, I)',
    clearGraphData: 'Clear Graph',
    burnoutWarning: 'Thermal Overload! Rated power exceeded (Filament fused)',

    spaceTitle: '3D Space & Relativistic Astronomy Lab',
    spaceSubtitle: 'N-Body Universal Gravitation · Velocity Verlet Integrator · Spacetime Deformation',
    cameraModeLabel: 'Camera Kinematics',
    camFree: 'Free Orbit',
    camChase: 'Chase Cam',
    camSurface: 'Surface View (Transit)',
    chaseTargetLabel: 'Target Body',
    presetSolar: 'Sun - Earth - Mars',
    presetEarthMoon: 'Earth - Moon - Satellite',
    presetExoplanet: 'Exoplanet Transit',
    presetGeostationary: 'Circular Orbit 1.5 R⊕ (Challenge 1)',
    presetLagrange: '3-Body Choreography (Challenge 2)',
    layersLabel: 'Physics Layers',
    layerSpacetime: 'Spacetime Mesh',
    layerGravityVec: 'Force Vectors (Fg)',
    layerVelocityVec: 'Velocity Vectors (v)',
    layerTrails: 'Orbital Trails',
    insertionVelocityLabel: 'Insertion Velocity Factor',
    gravityConstantLabel: 'Gravitational Scale (G)',
    timeStepLabel: 'Simulation Speed',
    hideControls: 'Hide Controls (Zen Mode)',
    showControls: 'Show Laboratory Controls',

    challengesHeader: 'Science Fair Experimental Missions & Challenges',
    validateChallenge: 'Validate Experiment Now',
    loadChallengeSetup: 'Load Base Setup',
    challengeCompleted: 'Challenge Mastered!',
    challengePending: 'Pending Validation',
    scoreLabel: 'Scientific Score',

    reportModalTitle: 'Official Scientific Report Generator',
    reportModalSubtitle: 'Structured documentation under the Scientific Method with live-captured telemetry',
    reportStudentLabel: 'Lead Researcher',
    reportLabTypeLabel: 'Active Experimental Module',
    reportQuestionLabel: '1. Research Question',
    reportQuestionPlaceholder: 'E.g., How does electrical current intensity vary as a function of potential difference across an ohmic conductor?',
    reportHypothesisLabel: '2. Formulated Hypothesis',
    reportHypothesisPlaceholder: 'E.g., If circuit resistance remains constant, electrical current will be directly proportional to applied voltage (V = I · R).',
    reportVariablesLabel: '3. Controlled, Independent & Dependent Variables',
    reportVariablesPlaceholder: 'E.g., Independent: Battery voltage (V). Dependent: Measured current (A). Controlled: Fixed electrical resistance (Ω).',
    reportResultsLabel: '4. Results Analysis & Conclusions',
    reportResultsPlaceholder: 'E.g., Experimental measurements confirm a constant linear slope with <0.1% relative error, validating Ohm’s Law...',
    reportTelemetryTitle: '5. Experimental Telemetry Automatically Extracted from Canvas',
    reportPrintBtn: 'Export to PDF / Print Scientific Format',
    reportCloseBtn: 'Close Report',

    archTitle: 'Modular Architecture & Project File Tree',
    archSubtitle: 'Strict separation of mathematical physics engines, WebGL/Canvas rendering, and pedagogical layers',
    gitTitle: 'Git & Vercel Deployment Guide',
    gitSubtitle: 'Exact commands to push updates to Laboratorio-Fisica-Avanzada and verify live deployment',
    foundationsTitle: 'Mathematical & Physical Engine Foundations',
    foundationsSubtitle: 'Numerical models implemented to ensure orbital stability and 60 FPS physical fidelity',
  },
};
