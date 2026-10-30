import { create } from 'zustand';
import { Language } from '../assets/js/i18n';
import { TelemetryItem } from '../assets/js/report-generator';
import {
  CelestialBody,
  SpacePresetId,
  createSpacePreset,
  createKeplerianCustomSystem,
  scaleCentralBodyMass,
  triggerPlanetaryCollisionCourse,
  spawnCustomPlanetOnPlane,
  injectBinarySchwarzschildSpaghettificationProbe,
} from '../labs/espacio-3d/space-engine';
import {
  ChemistryWorkbenchMode,
  ReactionPresetId,
  GasSpeciesId,
  REACTION_PRESETS,
} from '../labs/quimica-3d/chemistry-engine';

export type ActiveModuleView =
  | 'hub'
  | 'circuits'
  | 'space'
  | 'mechanics'
  | 'kinematics'
  | 'chemistry';
export type ModuleCategoryFilter =
  | 'all'
  | 'circuits'
  | 'space'
  | 'mechanics'
  | 'kinematics'
  | 'chemistry';

export interface ExternalResistorSync {
  target: 'R1' | 'R2' | 'R3';
  ohms: number;
  token: number;
}

export interface SpaceLabGlobalState {
  preset: SpacePresetId;
  isBlackHole: boolean;
  planetCreatorMode: boolean;
  centralMassSolar: number;
  gravityG: number;
  insertionFactor: number;
  simSpeed: number;
  semiMajorAxisAU: number;
  eccentricity: number;
  hohmannActive: boolean;
  showSpacetimeMesh: boolean;
  showGravityVectors: boolean;
  showVelocityVectors: boolean;
  showTrails: boolean;
  bodies: CelestialBody[];
  sceneRevision: number;
}

export interface ChemistryLabGlobalState {
  mode: ChemistryWorkbenchMode;
  reactionPreset: ReactionPresetId;
  molesA: number;
  molesB: number;
  reactorTempK: number;
  stirrerRpm: number;
  catalystActive: boolean;
  manualDetonated: boolean;
  gasSpecies: GasSpeciesId;
  gasMoles: number;
  gasTempK: number;
  gasVolumeLiters: number;
  gasSparkIgnited: boolean;
  vesselRevision: number;
}

export interface LabGlobalStore {
  // Estado global de navegación y plataforma
  lang: Language;
  activeView: ActiveModuleView;
  categoryFilter: ModuleCategoryFilter;
  labDisplayMode: 'swap' | 'grid';
  isAudioMuted: boolean;
  completedChallenges: Record<string, boolean>;
  totalScore: number;
  activeTelemetry: TelemetryItem[];
  externalResistorSync: ExternalResistorSync | null;

  // Estado centralizado del Laboratorio de Gravitación 3D
  spaceLab: SpaceLabGlobalState;

  // Estado centralizado del Laboratorio de Química 3D (Módulo 05)
  chemistryLab: ChemistryLabGlobalState;

  // Acciones globales de aplicación
  setLang: (lang: Language) => void;
  setActiveView: (view: ActiveModuleView) => void;
  setCategoryFilter: (filter: ModuleCategoryFilter) => void;
  setLabDisplayMode: (mode: 'swap' | 'grid') => void;
  setIsAudioMuted: (muted: boolean) => void;
  registerCompletedChallenge: (challengeId: string, awardedPoints: number) => void;
  setActiveTelemetry: (items: TelemetryItem[]) => void;
  setExternalResistorSync: (sync: ExternalResistorSync | null) => void;

  // Acciones atómicas de Gravitación 3D (garantizan invariancia entre Agujero Negro, Masa y Gravedad)
  setSpaceBlackHole: (enable?: boolean) => void;
  setSpacePlanetCreatorMode: (active?: boolean) => void;
  spawnPlanetAtCoords: (x: number, z: number) => void;
  setSpaceCentralMass: (massSolar: number) => void;
  setSpaceGravityG: (g: number) => void;
  setSpaceInsertionFactor: (factor: number) => void;
  setSpaceSimSpeed: (speed: number) => void;
  setSpacePreset: (preset: SpacePresetId, factor?: number) => void;
  setSpaceKeplerParams: (params: {
    semiMajorAxisAU?: number;
    eccentricity?: number;
    hohmannActive?: boolean;
  }) => void;
  setSpaceVisualLayers: (layers: Partial<{
    showSpacetimeMesh: boolean;
    showGravityVectors: boolean;
    showVelocityVectors: boolean;
    showTrails: boolean;
  }>) => void;
  triggerSpaceCollisionCataclysm: () => void;
  injectSchwarzschildProbe: () => void;
  setSpaceBodies: (bodies: CelestialBody[], bumpRevision?: boolean) => void;

  // Acciones atómicas del Laboratorio de Química 3D (Módulo 05)
  setChemistryMode: (mode: ChemistryWorkbenchMode) => void;
  setChemistryReactionPreset: (preset: ReactionPresetId) => void;
  setChemistryMoles: (params: { molesA?: number; molesB?: number }) => void;
  setChemistryReactorTemp: (tempK: number) => void;
  setChemistryStirrerRpm: (rpm: number) => void;
  setChemistryCatalystActive: (active?: boolean) => void;
  triggerChemistryDetonation: () => void;
  resetChemistryReactor: () => void;
  setChemistryGasSpecies: (species: GasSpeciesId) => void;
  setChemistryGasParams: (params: {
    gasMoles?: number;
    gasTempK?: number;
    gasVolumeLiters?: number;
  }) => void;
  triggerChemistryGasSpark: () => void;
}

function getInitialActiveView(): ActiveModuleView {
  if (typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedLab = searchParams.get('lab');
    if (requestedLab === 'circuits' || requestedLab === 'circuitos') return 'circuits';
    if (requestedLab === 'space' || requestedLab === 'espacio-3d') return 'space';
    if (requestedLab === 'mechanics' || requestedLab === 'mecanica-3d') return 'mechanics';
    if (requestedLab === 'kinematics' || requestedLab === 'cinematica') return 'kinematics';
    if (requestedLab === 'chemistry' || requestedLab === 'quimica' || requestedLab === 'quimica-3d')
      return 'chemistry';
  }
  return 'hub';
}

export const useLabGlobalStore = create<LabGlobalStore>((set) => ({
  lang: 'es',
  activeView: getInitialActiveView(),
  categoryFilter: 'all',
  labDisplayMode: 'swap',
  isAudioMuted: false,
  completedChallenges: {},
  totalScore: 0,
  activeTelemetry: [],
  externalResistorSync: null,

  spaceLab: {
    preset: 'solar',
    isBlackHole: false,
    planetCreatorMode: false,
    centralMassSolar: 1.0,
    gravityG: 1.0,
    insertionFactor: 1.0,
    simSpeed: 1.0,
    semiMajorAxisAU: 1.0,
    eccentricity: 0.0,
    hohmannActive: false,
    showSpacetimeMesh: true,
    showGravityVectors: true,
    showVelocityVectors: true,
    showTrails: true,
    bodies: createSpacePreset('solar', 1.0, 1.0),
    sceneRevision: 1,
  },

  chemistryLab: {
    mode: 'reactor',
    reactionPreset: 'alkali-explosion',
    molesA: REACTION_PRESETS['alkali-explosion'].defaultMolesA,
    molesB: REACTION_PRESETS['alkali-explosion'].defaultMolesB,
    reactorTempK: REACTION_PRESETS['alkali-explosion'].defaultTempK,
    stirrerRpm: 360,
    catalystActive: false,
    manualDetonated: false,
    gasSpecies: 'N2',
    gasMoles: 2.5,
    gasTempK: 320,
    gasVolumeLiters: 12.0,
    gasSparkIgnited: false,
    vesselRevision: 1,
  },

  setLang: (lang) => set({ lang }),
  setActiveView: (activeView) => set({ activeView }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setLabDisplayMode: (labDisplayMode) => set({ labDisplayMode }),
  setIsAudioMuted: (isAudioMuted) => set({ isAudioMuted }),
  registerCompletedChallenge: (challengeId, awardedPoints) =>
    set((state) => {
      if (state.completedChallenges[challengeId]) return state;
      return {
        completedChallenges: { ...state.completedChallenges, [challengeId]: true },
        totalScore: state.totalScore + awardedPoints,
      };
    }),
  setActiveTelemetry: (activeTelemetry) => set({ activeTelemetry }),
  setExternalResistorSync: (externalResistorSync) => set({ externalResistorSync }),

  setSpaceBlackHole: (enable) =>
    set((state) => {
      const nextIsBlackHole = enable !== undefined ? enable : !state.spaceLab.isBlackHole;
      // Escala el astro central respetando la masa actual (centralMassSolar) y la gravedad (gravityG) sin reiniciarlas
      const updatedBodies = scaleCentralBodyMass(
        state.spaceLab.bodies,
        state.spaceLab.centralMassSolar,
        nextIsBlackHole
      );
      return {
        spaceLab: {
          ...state.spaceLab,
          isBlackHole: nextIsBlackHole,
          bodies: updatedBodies,
          sceneRevision: state.spaceLab.sceneRevision + 1,
        },
      };
    }),

  setSpacePlanetCreatorMode: (active) =>
    set((state) => ({
      spaceLab: {
        ...state.spaceLab,
        planetCreatorMode: active !== undefined ? active : !state.spaceLab.planetCreatorMode,
      },
    })),

  spawnPlanetAtCoords: (x, z) =>
    set((state) => {
      const nextBodies = spawnCustomPlanetOnPlane(
        state.spaceLab.bodies,
        x,
        z,
        state.spaceLab.gravityG,
        state.spaceLab.insertionFactor
      );
      return {
        spaceLab: {
          ...state.spaceLab,
          bodies: nextBodies,
          sceneRevision: state.spaceLab.sceneRevision + 1,
        },
      };
    }),

  setSpaceCentralMass: (massSolar) =>
    set((state) => {
      const clampedMass = Math.max(0.2, Math.min(3.5, massSolar));
      const updatedBodies = scaleCentralBodyMass(
        state.spaceLab.bodies,
        clampedMass,
        state.spaceLab.isBlackHole
      );
      return {
        spaceLab: {
          ...state.spaceLab,
          centralMassSolar: clampedMass,
          bodies: updatedBodies,
          sceneRevision: state.spaceLab.sceneRevision + 1,
        },
      };
    }),

  setSpaceGravityG: (g) =>
    set((state) => {
      const clampedG = Math.max(0.2, Math.min(3.0, g));
      // Mantiene intactos tanto el modo Agujero Negro como la masa central configurada
      const updatedBodies = scaleCentralBodyMass(
        state.spaceLab.bodies,
        state.spaceLab.centralMassSolar,
        state.spaceLab.isBlackHole
      );
      return {
        spaceLab: {
          ...state.spaceLab,
          gravityG: clampedG,
          bodies: updatedBodies,
        },
      };
    }),

  setSpaceInsertionFactor: (factor) =>
    set((state) => {
      const baseBodies = createSpacePreset(
        state.spaceLab.preset,
        factor,
        state.spaceLab.gravityG
      );
      const updatedBodies = scaleCentralBodyMass(
        baseBodies,
        state.spaceLab.centralMassSolar,
        state.spaceLab.isBlackHole
      );
      return {
        spaceLab: {
          ...state.spaceLab,
          insertionFactor: factor,
          bodies: updatedBodies,
          sceneRevision: state.spaceLab.sceneRevision + 1,
        },
      };
    }),

  setSpaceSimSpeed: (simSpeed) =>
    set((state) => ({
      spaceLab: {
        ...state.spaceLab,
        simSpeed,
      },
    })),

  setSpacePreset: (preset, factor) =>
    set((state) => {
      const nextFactor = factor !== undefined ? factor : state.spaceLab.insertionFactor;
      const effectiveBlackHole = preset === 'binary-bh' ? true : state.spaceLab.isBlackHole;
      const baseBodies = createSpacePreset(preset, nextFactor, state.spaceLab.gravityG);
      const updatedBodies = scaleCentralBodyMass(
        baseBodies,
        state.spaceLab.centralMassSolar,
        effectiveBlackHole
      );
      return {
        spaceLab: {
          ...state.spaceLab,
          preset,
          isBlackHole: effectiveBlackHole,
          insertionFactor: nextFactor,
          bodies: updatedBodies,
          sceneRevision: state.spaceLab.sceneRevision + 1,
        },
      };
    }),

  setSpaceKeplerParams: (params) =>
    set((state) => {
      const nextA = params.semiMajorAxisAU ?? state.spaceLab.semiMajorAxisAU;
      const nextE = params.eccentricity ?? state.spaceLab.eccentricity;
      const nextHohmann = params.hohmannActive ?? state.spaceLab.hohmannActive;

      const keplerBodies = createKeplerianCustomSystem({
        centralMassSolar: state.spaceLab.centralMassSolar,
        semiMajorAxisAU: nextA,
        eccentricity: nextE,
        isHohmannTransferActive: nextHohmann,
        G: state.spaceLab.gravityG,
        isBlackHole: state.spaceLab.isBlackHole,
      });

      const updatedBodies = scaleCentralBodyMass(
        keplerBodies,
        state.spaceLab.centralMassSolar,
        state.spaceLab.isBlackHole
      );

      return {
        spaceLab: {
          ...state.spaceLab,
          semiMajorAxisAU: nextA,
          eccentricity: nextE,
          hohmannActive: nextHohmann,
          bodies: updatedBodies,
          sceneRevision: state.spaceLab.sceneRevision + 1,
        },
      };
    }),

  setSpaceVisualLayers: (layers) =>
    set((state) => ({
      spaceLab: {
        ...state.spaceLab,
        ...layers,
      },
    })),

  triggerSpaceCollisionCataclysm: () =>
    set((state) => {
      let sourceBodies = state.spaceLab.bodies;
      if (sourceBodies.length <= 1) {
        const fresh = createSpacePreset(
          state.spaceLab.preset,
          0.25,
          state.spaceLab.gravityG
        );
        sourceBodies = scaleCentralBodyMass(
          fresh,
          state.spaceLab.centralMassSolar,
          state.spaceLab.isBlackHole
        );
      }
      const crashingBodies = triggerPlanetaryCollisionCourse(sourceBodies);
      return {
        spaceLab: {
          ...state.spaceLab,
          bodies: crashingBodies,
          sceneRevision: state.spaceLab.sceneRevision + 1,
        },
      };
    }),

  injectSchwarzschildProbe: () =>
    set((state) => {
      const baseBinary =
        state.spaceLab.preset === 'binary-bh'
          ? state.spaceLab.bodies
          : scaleCentralBodyMass(
              createSpacePreset('binary-bh', 1.0, state.spaceLab.gravityG),
              state.spaceLab.centralMassSolar,
              true
            );
      const nextBodies = injectBinarySchwarzschildSpaghettificationProbe(
        baseBinary,
        state.spaceLab.gravityG
      );
      return {
        spaceLab: {
          ...state.spaceLab,
          preset: 'binary-bh',
          isBlackHole: true,
          bodies: nextBodies,
          sceneRevision: state.spaceLab.sceneRevision + 1,
        },
      };
    }),

  setSpaceBodies: (bodies, bumpRevision = false) =>
    set((state) => ({
      spaceLab: {
        ...state.spaceLab,
        bodies,
        sceneRevision: bumpRevision
          ? state.spaceLab.sceneRevision + 1
          : state.spaceLab.sceneRevision,
      },
    })),

  setChemistryMode: (mode) =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        mode,
      },
    })),

  setChemistryReactionPreset: (reactionPreset) =>
    set((state) => {
      const presetDef = REACTION_PRESETS[reactionPreset];
      return {
        chemistryLab: {
          ...state.chemistryLab,
          reactionPreset,
          molesA: presetDef.defaultMolesA,
          molesB: presetDef.defaultMolesB,
          reactorTempK: presetDef.defaultTempK,
          catalystActive: false,
          manualDetonated: false,
          vesselRevision: state.chemistryLab.vesselRevision + 1,
        },
      };
    }),

  setChemistryMoles: (params) =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        molesA:
          params.molesA !== undefined
            ? Math.max(0, Math.min(6.0, params.molesA))
            : state.chemistryLab.molesA,
        molesB:
          params.molesB !== undefined
            ? Math.max(0, Math.min(6.0, params.molesB))
            : state.chemistryLab.molesB,
      },
    })),

  setChemistryReactorTemp: (reactorTempK) =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        reactorTempK: Math.max(260, Math.min(1100, reactorTempK)),
      },
    })),

  setChemistryStirrerRpm: (stirrerRpm) =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        stirrerRpm: Math.max(0, Math.min(1200, stirrerRpm)),
      },
    })),

  setChemistryCatalystActive: (active) =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        catalystActive:
          active !== undefined ? active : !state.chemistryLab.catalystActive,
      },
    })),

  triggerChemistryDetonation: () =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        molesA: Math.max(2.6, state.chemistryLab.molesA),
        molesB: Math.max(3.2, state.chemistryLab.molesB),
        reactorTempK: 920,
        catalystActive: true,
        manualDetonated: true,
      },
    })),

  resetChemistryReactor: () =>
    set((state) => {
      const presetDef = REACTION_PRESETS[state.chemistryLab.reactionPreset];
      return {
        chemistryLab: {
          ...state.chemistryLab,
          molesA: presetDef.defaultMolesA,
          molesB: presetDef.defaultMolesB,
          reactorTempK: presetDef.defaultTempK,
          catalystActive: false,
          manualDetonated: false,
          gasMoles: 2.5,
          gasTempK: 320,
          gasVolumeLiters: 12.0,
          gasSparkIgnited: false,
          vesselRevision: state.chemistryLab.vesselRevision + 1,
        },
      };
    }),

  setChemistryGasSpecies: (gasSpecies) =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        gasSpecies,
        gasSparkIgnited: false,
        vesselRevision: state.chemistryLab.vesselRevision + 1,
      },
    })),

  setChemistryGasParams: (params) =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        gasMoles:
          params.gasMoles !== undefined
            ? Math.max(0.2, Math.min(12.0, params.gasMoles))
            : state.chemistryLab.gasMoles,
        gasTempK:
          params.gasTempK !== undefined
            ? Math.max(120, Math.min(1000, params.gasTempK))
            : state.chemistryLab.gasTempK,
        gasVolumeLiters:
          params.gasVolumeLiters !== undefined
            ? Math.max(2.0, Math.min(24.0, params.gasVolumeLiters))
            : state.chemistryLab.gasVolumeLiters,
      },
    })),

  triggerChemistryGasSpark: () =>
    set((state) => ({
      chemistryLab: {
        ...state.chemistryLab,
        gasSparkIgnited: true,
      },
    })),
}));
