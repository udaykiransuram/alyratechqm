"use client";

import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import { cn } from "@/lib/utils";

import {
  HOME_SCENE_STATES,
  type HomeRenderMode,
  type HomeSceneKey,
  type HomeSceneState,
} from "./home-content";

export type HomeSceneCanvasProps = {
  activeChapterId: HomeSceneKey;
  nextChapterId: HomeSceneKey;
  blend: number;
  renderMode: Exclude<HomeRenderMode, "poster">;
  reducedMotion: boolean;
  className?: string;
};

type SceneVisualState = {
  paperVisibility: number;
  paperScan: number;
  paperLift: number;
  terrainVisibility: number;
  peakBoost: number;
  valleyBoost: number;
  hotspotOpacity: number;
  hotspotFocus: number;
  constellationVisibility: number;
  constellationLift: number;
  activePath: number;
  modulesVisibility: number;
  modulesSpread: number;
  warmMix: number;
  scanOpacity: number;
  terrainRipple: number;
};

type ModulePanelRef = {
  group: Group;
  shell: Mesh;
  lines: Mesh[];
};

type HotspotRef = {
  group: Group;
  stem: Mesh;
  cap: Mesh;
  ring: Mesh;
  featureIndex: number;
};

type HeroAnswerRef = {
  mesh: Mesh;
  start: Vector3;
  target: Vector3;
  travel: number;
  warm: boolean;
  phase: number;
};

type SceneRefs = {
  root: Group;
  paperGroup: Group;
  paperSheet: Mesh;
  paperAura: Mesh;
  paperScanBeam: Mesh;
  paperAnswers: HeroAnswerRef[];
  terrainGroup: Group;
  terrainSurface: Mesh;
  terrainWire: Mesh;
  terrainBase: Float32Array;
  terrainPositions: BufferAttribute;
  terrainWireMaterial: MeshBasicMaterial;
  terrainMaterial: MeshPhysicalMaterial;
  terrainUnderlay: Mesh;
  hotspots: HotspotRef[];
  scanRings: Mesh[];
  constellationGroup: Group;
  constellationNodes: Mesh[];
  constellationEdges: LineSegments;
  constellationEdgesPositions: BufferAttribute;
  constellationActiveEdges: LineSegments;
  constellationActiveEdgesPositions: BufferAttribute;
  moduleGroup: Group;
  modulePanels: ModulePanelRef[];
  sparkleField: Points;
  sparkleBase: Float32Array;
  sparklePhase: Float32Array;
  backdrop: Mesh;
};

const TERRAIN_FEATURES = [
  { x: -3.4, z: -2.5, amplitude: 1.42, spread: 1.7 },
  { x: -1.3, z: 1.45, amplitude: -1.84, spread: 1.18 },
  { x: 2.8, z: -1.1, amplitude: 1.08, spread: 1.46 },
  { x: 3.25, z: 2.55, amplitude: -1.12, spread: 1.04 },
  { x: 0.45, z: 0.1, amplitude: -2.18, spread: 0.92 },
  { x: -0.5, z: -3.0, amplitude: 0.88, spread: 1.22 },
] as const;

const HOTSPOT_FEATURE_INDICES = [0, 1, 2, 4, 5] as const;

const CONSTELLATION_BASE_POSITIONS = [
  new Vector3(-2.55, 1.5, 1.45),
  new Vector3(-1.45, 1.05, 0.72),
  new Vector3(-0.3, 1.3, 0.95),
  new Vector3(0.95, 1.78, 0.35),
  new Vector3(2.15, 1.05, -0.12),
  new Vector3(0.12, 0.42, -0.52),
  new Vector3(-1.22, 0.18, -0.42),
  new Vector3(1.58, 0.32, -1.02),
  new Vector3(2.86, 0.84, 1.14),
] as const;

const CONSTELLATION_EDGE_PAIRS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 6],
  [6, 5],
  [5, 7],
  [3, 8],
  [5, 3],
] as const satisfies readonly (readonly [number, number])[];

const CONSTELLATION_ACTIVE_EDGE_PAIRS = [
  [1, 2],
  [2, 3],
  [3, 4],
  [6, 5],
  [5, 3],
] as const satisfies readonly (readonly [number, number])[];

const ACTIVE_NODE_SET = new Set([1, 2, 3, 4, 5, 6]);
const MODULE_ANGLES = [-1.85, -0.75, 0.32, 1.22, 2.08] as const;
const HERO_ANSWER_POINTS = [
  {
    start: new Vector3(-0.72, 1.02, 0.08),
    target: new Vector3(-1.48, 2.02, 0.26),
    travel: 0.86,
    warm: false,
    phase: 0.2,
  },
  {
    start: new Vector3(-0.36, 0.98, 0.08),
    target: new Vector3(-0.98, 1.72, 0.4),
    travel: 0.72,
    warm: true,
    phase: 0.8,
  },
  {
    start: new Vector3(0.02, 0.9, 0.08),
    target: new Vector3(-0.12, 1.92, 0.56),
    travel: 0.92,
    warm: false,
    phase: 1.3,
  },
  {
    start: new Vector3(0.44, 0.96, 0.08),
    target: new Vector3(0.46, 1.52, 0.78),
    travel: 0.6,
    warm: true,
    phase: 1.6,
  },
  {
    start: new Vector3(-0.78, 0.26, 0.08),
    target: new Vector3(-1.7, 1.14, 0.18),
    travel: 0.82,
    warm: false,
    phase: 1.9,
  },
  {
    start: new Vector3(-0.26, 0.22, 0.08),
    target: new Vector3(-0.74, 1.16, 0.48),
    travel: 0.74,
    warm: true,
    phase: 2.4,
  },
  {
    start: new Vector3(0.22, 0.18, 0.08),
    target: new Vector3(0.14, 1.34, 0.64),
    travel: 0.96,
    warm: false,
    phase: 2.8,
  },
  {
    start: new Vector3(0.66, 0.18, 0.08),
    target: new Vector3(0.9, 1.04, 0.9),
    travel: 0.66,
    warm: true,
    phase: 3.2,
  },
  {
    start: new Vector3(-0.64, -0.58, 0.08),
    target: new Vector3(-1.22, 0.42, 0.24),
    travel: 0.7,
    warm: false,
    phase: 3.7,
  },
  {
    start: new Vector3(-0.08, -0.54, 0.08),
    target: new Vector3(-0.12, 0.54, 0.52),
    travel: 0.9,
    warm: true,
    phase: 4.1,
  },
  {
    start: new Vector3(0.36, -0.5, 0.08),
    target: new Vector3(0.58, 0.82, 0.84),
    travel: 0.84,
    warm: false,
    phase: 4.5,
  },
] as const;

const SCENE_VISUALS: Record<HomeSceneKey, SceneVisualState> = {
  hero: {
    paperVisibility: 1,
    paperScan: 1,
    paperLift: 1,
    terrainVisibility: 1,
    peakBoost: 1.02,
    valleyBoost: 0.22,
    hotspotOpacity: 0.78,
    hotspotFocus: 0.35,
    constellationVisibility: 0.08,
    constellationLift: 0.08,
    activePath: 0,
    modulesVisibility: 0.22,
    modulesSpread: 0.84,
    warmMix: 0.14,
    scanOpacity: 0.34,
    terrainRipple: 0.22,
  },
  patterns: {
    paperVisibility: 0.3,
    paperScan: 0.4,
    paperLift: 0.48,
    terrainVisibility: 1.08,
    peakBoost: 0.94,
    valleyBoost: 0.74,
    hotspotOpacity: 1,
    hotspotFocus: 1,
    constellationVisibility: 0.2,
    constellationLift: 0.22,
    activePath: 0.14,
    modulesVisibility: 0.16,
    modulesSpread: 0.76,
    warmMix: 0.22,
    scanOpacity: 0.54,
    terrainRipple: 0.28,
  },
  drilldown: {
    paperVisibility: 0,
    paperScan: 0,
    paperLift: 0,
    terrainVisibility: 0.62,
    peakBoost: 0.74,
    valleyBoost: 0.92,
    hotspotOpacity: 0.44,
    hotspotFocus: 1.18,
    constellationVisibility: 1,
    constellationLift: 0.92,
    activePath: 1,
    modulesVisibility: 0.36,
    modulesSpread: 0.62,
    warmMix: 0.68,
    scanOpacity: 0.22,
    terrainRipple: 0.12,
  },
  platform: {
    paperVisibility: 0,
    paperScan: 0,
    paperLift: 0,
    terrainVisibility: 0.5,
    peakBoost: 0.78,
    valleyBoost: 0.38,
    hotspotOpacity: 0.34,
    hotspotFocus: 0.32,
    constellationVisibility: 0.56,
    constellationLift: 0.58,
    activePath: 0.34,
    modulesVisibility: 1,
    modulesSpread: 1.12,
    warmMix: 0.32,
    scanOpacity: 0.16,
    terrainRipple: 0.14,
  },
};

function mixSceneState(
  current: HomeSceneState,
  next: HomeSceneState,
  blend: number,
): HomeSceneState {
  const mix = (from: number, to: number) => MathUtils.lerp(from, to, blend);
  const mixTuple = (
    from: [number, number, number],
    to: [number, number, number],
  ): [number, number, number] => [
    mix(from[0], to[0]),
    mix(from[1], to[1]),
    mix(from[2], to[2]),
  ];

  return {
    camera: mixTuple(current.camera, next.camera),
    target: mixTuple(current.target, next.target),
    coreScale: mix(current.coreScale, next.coreScale),
    ringScale: mix(current.ringScale, next.ringScale),
    ringTilt: mix(current.ringTilt, next.ringTilt),
    orbitRadius: mix(current.orbitRadius, next.orbitRadius),
    slabSpread: mix(current.slabSpread, next.slabSpread),
    slabLift: mix(current.slabLift, next.slabLift),
    slabOpacity: mix(current.slabOpacity, next.slabOpacity),
    columnBias: mix(current.columnBias, next.columnBias),
    columnHeights: [
      mix(current.columnHeights[0], next.columnHeights[0]),
      mix(current.columnHeights[1], next.columnHeights[1]),
      mix(current.columnHeights[2], next.columnHeights[2]),
      mix(current.columnHeights[3], next.columnHeights[3]),
    ],
    moduleArc: mix(current.moduleArc, next.moduleArc),
    moduleLift: mix(current.moduleLift, next.moduleLift),
    clusterScale: mix(current.clusterScale, next.clusterScale),
    latticeScale: mix(current.latticeScale, next.latticeScale),
    glow: mix(current.glow, next.glow),
    warmMix: mix(current.warmMix, next.warmMix),
  };
}

function mixSceneVisual(
  current: SceneVisualState,
  next: SceneVisualState,
  blend: number,
): SceneVisualState {
  const mix = (from: number, to: number) => MathUtils.lerp(from, to, blend);

  return {
    paperVisibility: mix(current.paperVisibility, next.paperVisibility),
    paperScan: mix(current.paperScan, next.paperScan),
    paperLift: mix(current.paperLift, next.paperLift),
    terrainVisibility: mix(current.terrainVisibility, next.terrainVisibility),
    peakBoost: mix(current.peakBoost, next.peakBoost),
    valleyBoost: mix(current.valleyBoost, next.valleyBoost),
    hotspotOpacity: mix(current.hotspotOpacity, next.hotspotOpacity),
    hotspotFocus: mix(current.hotspotFocus, next.hotspotFocus),
    constellationVisibility: mix(
      current.constellationVisibility,
      next.constellationVisibility,
    ),
    constellationLift: mix(current.constellationLift, next.constellationLift),
    activePath: mix(current.activePath, next.activePath),
    modulesVisibility: mix(current.modulesVisibility, next.modulesVisibility),
    modulesSpread: mix(current.modulesSpread, next.modulesSpread),
    warmMix: mix(current.warmMix, next.warmMix),
    scanOpacity: mix(current.scanOpacity, next.scanOpacity),
    terrainRipple: mix(current.terrainRipple, next.terrainRipple),
  };
}

function dampNumber(
  current: number,
  target: number,
  speed: number,
  delta: number,
) {
  return MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));
}

function disposeMaterial(material: unknown) {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  if (
    typeof material === "object" &&
    material !== null &&
    "dispose" in material &&
    typeof material.dispose === "function"
  ) {
    material.dispose();
  }
}

function computeTerrainHeight(
  x: number,
  z: number,
  elapsed: number,
  motionFactor: number,
  visual: SceneVisualState,
) {
  let height = -0.18;

  TERRAIN_FEATURES.forEach((feature, featureIndex) => {
    const dx = x - feature.x;
    const dz = z - feature.z;
    const gaussian = Math.exp(
      -((dx * dx + dz * dz) / (feature.spread * feature.spread * 2.4)),
    );
    const negative = feature.amplitude < 0;
    const boost = negative
      ? 1 + visual.valleyBoost + (featureIndex === 4 ? visual.hotspotFocus * 0.2 : 0)
      : visual.peakBoost;
    height += feature.amplitude * boost * gaussian * visual.terrainVisibility;
  });

  const edgeFade = Math.max(0.74, 1 - Math.sqrt(x * x + z * z) / 15);
  const ripple =
    Math.sin(x * 0.84 + elapsed * 0.18) *
    Math.cos(z * 0.72 - elapsed * 0.12) *
    0.14 *
    visual.terrainRipple *
    motionFactor;

  return height * edgeFade + ripple;
}

function createLineSegments(
  edgePairs: readonly (readonly [number, number])[],
  color: string,
  opacity: number,
) {
  const positions = new Float32Array(edgePairs.length * 6);
  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);

  const line = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color,
      transparent: true,
      opacity,
    }),
  );

  return {
    line,
    positions: attribute,
  };
}

function buildSceneWorld(
  scene: Scene,
  renderMode: Exclude<HomeRenderMode, "poster">,
) {
  const root = new Group();
  scene.add(root);

  const paperGroup = new Group();
  paperGroup.position.set(-0.35, 1.05, 1.38);
  paperGroup.rotation.set(-0.42, -0.28, 0.18);
  root.add(paperGroup);

  const paperSheet = new Mesh(
    new BoxGeometry(2.52, 3.42, 0.06),
    new MeshPhysicalMaterial({
      color: "#f7fbff",
      emissive: "#7eeeff",
      emissiveIntensity: 0.08,
      roughness: 0.14,
      metalness: 0.04,
      clearcoat: 0.52,
      transparent: true,
      opacity: 0.96,
    }),
  );
  paperGroup.add(paperSheet);

  const paperBacking = new Mesh(
    new BoxGeometry(2.68, 3.58, 0.04),
    new MeshBasicMaterial({
      color: "#102447",
      transparent: true,
      opacity: 0.34,
    }),
  );
  paperBacking.position.z = -0.06;
  paperGroup.add(paperBacking);

  [-1.1, -0.72, -0.34, 0.04, 0.42, 0.8].forEach((lineY, index) => {
    const line = new Mesh(
      new BoxGeometry(index === 0 ? 1.08 : 1.42, 0.028, 0.02),
      new MeshBasicMaterial({
        color: index % 2 === 0 ? "#6defff" : "#ffcb80",
        transparent: true,
        opacity: index === 0 ? 0.28 : 0.14,
      }),
    );
    line.position.set(index === 0 ? -0.42 : 0, lineY, 0.045);
    paperGroup.add(line);
  });

  const paperAura = new Mesh(
    new PlaneGeometry(4.2, 4.8),
    new MeshBasicMaterial({
      color: "#78efff",
      transparent: true,
      opacity: 0.18,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  paperAura.position.set(0.34, 0.28, -0.16);
  paperGroup.add(paperAura);

  const paperScanBeam = new Mesh(
    new PlaneGeometry(2.18, 0.26),
    new MeshBasicMaterial({
      color: "#90f8ff",
      transparent: true,
      opacity: 0.32,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  paperScanBeam.position.set(0, 0.8, 0.06);
  paperGroup.add(paperScanBeam);

  const paperAnswers = HERO_ANSWER_POINTS.map((point) => {
    const mesh = new Mesh(
      new SphereGeometry(point.warm ? 0.1 : 0.085, 18, 18),
      new MeshStandardMaterial({
        color: point.warm ? "#ffc47e" : "#9df8ff",
        emissive: point.warm ? "#ffc47e" : "#8cefff",
        emissiveIntensity: point.warm ? 0.92 : 0.82,
        transparent: true,
        opacity: 0.84,
      }),
    );
    mesh.position.copy(point.start);
    paperGroup.add(mesh);

    return {
      mesh,
      start: point.start.clone(),
      target: point.target.clone(),
      travel: point.travel,
      warm: point.warm,
      phase: point.phase,
    } satisfies HeroAnswerRef;
  });

  const terrainGroup = new Group();
  terrainGroup.position.set(0, -1.2, 0.24);
  root.add(terrainGroup);

  const terrainGeometry = new PlaneGeometry(11.8, 11.8, 48, 48);
  terrainGeometry.rotateX(-Math.PI / 2);
  const terrainBase = new Float32Array(
    (terrainGeometry.attributes.position.array as ArrayLike<number>).length,
  );
  terrainBase.set(
    terrainGeometry.attributes.position.array as ArrayLike<number>,
  );

  const terrainMaterial = new MeshPhysicalMaterial({
    color: "#17385c",
    emissive: "#1d6d98",
    emissiveIntensity: 0.48,
    roughness: 0.52,
    metalness: 0.18,
    clearcoat: 0.22,
    transparent: true,
    opacity: 0.94,
    side: DoubleSide,
  });
  const terrainSurface = new Mesh(terrainGeometry, terrainMaterial);
  terrainGroup.add(terrainSurface);

  const terrainWireMaterial = new MeshBasicMaterial({
    color: "#78f7ff",
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  });
  const terrainWire = new Mesh(terrainGeometry, terrainWireMaterial);
  terrainWire.position.y = 0.02;
  terrainGroup.add(terrainWire);

  const terrainUnderlay = new Mesh(
    new CircleGeometry(6.4, 64),
    new MeshBasicMaterial({
      color: "#081426",
      transparent: true,
      opacity: 0.34,
    }),
  );
  terrainUnderlay.rotation.x = -Math.PI / 2;
  terrainUnderlay.position.y = -0.32;
  terrainGroup.add(terrainUnderlay);

  const scanRings = [2.45, 3.55].map((radius) => {
    const ring = new Mesh(
      new TorusGeometry(radius, 0.028, 12, 144),
      new MeshStandardMaterial({
        color: "#80f8ff",
        emissive: "#52e5ff",
        emissiveIntensity: 0.78,
        transparent: true,
        opacity: 0.18,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    terrainGroup.add(ring);
    return ring;
  });

  const hotspotGeometry = new CylinderGeometry(0.04, 0.06, 1, 12);
  const hotspotCapGeometry = new SphereGeometry(0.14, 18, 18);
  const hotspotRingGeometry = new TorusGeometry(0.32, 0.018, 8, 90);
  const hotspots = HOTSPOT_FEATURE_INDICES.map((featureIndex) => {
    const group = new Group();
    const stem = new Mesh(
      hotspotGeometry,
      new MeshPhysicalMaterial({
        color: "#9cfbff",
        emissive: "#62e8ff",
        emissiveIntensity: 0.92,
        transparent: true,
        opacity: 0.42,
      }),
    );
    stem.position.y = 0.5;
    group.add(stem);

    const cap = new Mesh(
      hotspotCapGeometry,
      new MeshStandardMaterial({
        color: "#b4fbff",
        emissive: "#8df1ff",
        emissiveIntensity: 1.08,
        transparent: true,
        opacity: 0.92,
      }),
    );
    cap.position.y = 1;
    group.add(cap);

    const ring = new Mesh(
      hotspotRingGeometry,
      new MeshBasicMaterial({
        color: "#7eefff",
        transparent: true,
        opacity: 0.42,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    terrainGroup.add(group);

    return {
      group,
      stem,
      cap,
      ring,
      featureIndex,
    } satisfies HotspotRef;
  });

  const constellationGroup = new Group();
  constellationGroup.position.set(0, 0.4, 0.18);
  root.add(constellationGroup);

  const baseEdgeResult = createLineSegments(
    CONSTELLATION_EDGE_PAIRS,
    "#68efff",
    0.24,
  );
  constellationGroup.add(baseEdgeResult.line);

  const activeEdgeResult = createLineSegments(
    CONSTELLATION_ACTIVE_EDGE_PAIRS,
    "#ffca7e",
    0.82,
  );
  constellationGroup.add(activeEdgeResult.line);

  const constellationNodes = CONSTELLATION_BASE_POSITIONS.map((position, index) => {
    const node = new Mesh(
      new SphereGeometry(index === 4 ? 0.18 : 0.13, 18, 18),
      new MeshStandardMaterial({
        color: ACTIVE_NODE_SET.has(index) ? "#ffc27b" : "#9df8ff",
        emissive: ACTIVE_NODE_SET.has(index) ? "#ffc27b" : "#68ebff",
        emissiveIntensity: ACTIVE_NODE_SET.has(index) ? 1 : 0.82,
        transparent: true,
        opacity: 0.92,
      }),
    );
    node.position.copy(position);
    constellationGroup.add(node);
    return node;
  });

  const moduleGroup = new Group();
  moduleGroup.position.set(0, 0.52, -0.2);
  root.add(moduleGroup);

  const modulePanels = MODULE_ANGLES.map((angle, index) => {
    const group = new Group();
    const shell = new Mesh(
      new BoxGeometry(1.32, 0.86, 0.08),
      new MeshPhysicalMaterial({
        color: index % 2 === 0 ? "#17304d" : "#1a3555",
        emissive: index === 2 ? "#ffbf78" : "#5be8ff",
        emissiveIntensity: 0.22,
        roughness: 0.22,
        metalness: 0.2,
        transparent: true,
        opacity: 0.3,
      }),
    );
    group.add(shell);

    const lineTop = new Mesh(
      new BoxGeometry(0.74, 0.05, 0.02),
      new MeshBasicMaterial({
        color: index === 2 ? "#ffc47f" : "#84f3ff",
        transparent: true,
        opacity: 0.84,
      }),
    );
    lineTop.position.set(0, 0.13, 0.06);
    group.add(lineTop);

    const lineBottom = new Mesh(
      new BoxGeometry(0.46, 0.05, 0.02),
      new MeshBasicMaterial({
        color: "#9af7ff",
        transparent: true,
        opacity: 0.48,
      }),
    );
    lineBottom.position.set(-0.1, -0.05, 0.06);
    group.add(lineBottom);

    moduleGroup.add(group);

    return {
      group,
      shell,
      lines: [lineTop, lineBottom],
    } satisfies ModulePanelRef;
  });

  const sparkleCount = renderMode === "full3d" ? 84 : 48;
  const sparkleBase = new Float32Array(sparkleCount * 3);
  const sparklePhase = new Float32Array(sparkleCount);
  for (let index = 0; index < sparkleCount; index += 1) {
    const radius = 3.4 + Math.random() * 3.4;
    const theta = Math.random() * Math.PI * 2;
    sparkleBase[index * 3] = Math.cos(theta) * radius;
    sparkleBase[index * 3 + 1] = Math.random() * 5.8 - 2.2;
    sparkleBase[index * 3 + 2] = Math.sin(theta) * radius * 0.74;
    sparklePhase[index] = Math.random() * Math.PI * 2;
  }
  const sparkleGeometry = new BufferGeometry();
  sparkleGeometry.setAttribute(
    "position",
    new BufferAttribute(sparkleBase.slice(), 3),
  );
  const sparkleField = new Points(
    sparkleGeometry,
    new PointsMaterial({
      color: "#bcfcff",
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.52,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(sparkleField);

  const backdrop = new Mesh(
    new PlaneGeometry(18, 18),
    new MeshBasicMaterial({
      color: "#081528",
      transparent: true,
      opacity: 0.28,
      blending: AdditiveBlending,
    }),
  );
  backdrop.position.set(0, 0.1, -4.2);
  scene.add(backdrop);

  return {
    root,
    paperGroup,
    paperSheet,
    paperAura,
    paperScanBeam,
    paperAnswers,
    terrainGroup,
    terrainSurface,
    terrainWire,
    terrainBase,
    terrainPositions: terrainGeometry.attributes.position as BufferAttribute,
    terrainWireMaterial,
    terrainMaterial,
    terrainUnderlay,
    hotspots,
    scanRings,
    constellationGroup,
    constellationNodes,
    constellationEdges: baseEdgeResult.line,
    constellationEdgesPositions: baseEdgeResult.positions,
    constellationActiveEdges: activeEdgeResult.line,
    constellationActiveEdgesPositions: activeEdgeResult.positions,
    moduleGroup,
    modulePanels,
    sparkleField,
    sparkleBase,
    sparklePhase,
    backdrop,
  } satisfies SceneRefs;
}

export function HomeSceneCanvas({
  activeChapterId,
  nextChapterId,
  blend,
  renderMode,
  reducedMotion,
  className,
}: HomeSceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({
    activeChapterId,
    nextChapterId,
    blend,
    renderMode,
    reducedMotion,
  });

  propsRef.current = {
    activeChapterId,
    nextChapterId,
    blend,
    renderMode,
    reducedMotion,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor("#000000", 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = "h-full w-full";
    container.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.fog = new Fog("#06111e", 7.5, 18.5);

    const camera = new PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 8.2);

    const ambientLight = new AmbientLight("#eef8ff", 0.82);
    scene.add(ambientLight);

    const primaryLight = new DirectionalLight("#dff4ff", 1.76);
    primaryLight.position.set(5.8, 7.4, 5.4);
    scene.add(primaryLight);

    const accentLight = new DirectionalLight("#5defff", 1.02);
    accentLight.position.set(-4.8, 3.8, 4.3);
    scene.add(accentLight);

    const warmLight = new DirectionalLight("#ffc27c", 0.34);
    warmLight.position.set(1.5, 2.2, 6.5);
    scene.add(warmLight);

    const sceneRefs = buildSceneWorld(scene, renderMode);
    const lookAtTarget = new Vector3(0, 0, 0);
    const targetVector = new Vector3();
    const coolSurface = new Color("#17385c");
    const coolEmission = new Color("#1d6d98");
    const warmSurface = new Color("#29405f");
    const warmEmission = new Color("#dd8f46");
    const coolNode = new Color("#9afcff");
    const warmNode = new Color("#ffc27b");
    const alertNode = new Color("#ff8a68");
    const tempColor = new Color();

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", resize);
    }

    const startTime = performance.now();
    let frameId = 0;
    let lastTime = startTime;

    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const elapsed = (time - startTime) / 1000;
      const currentProps = propsRef.current;
      const motionFactor = currentProps.reducedMotion ? 0.14 : 1;
      const target = mixSceneState(
        HOME_SCENE_STATES[currentProps.activeChapterId],
        HOME_SCENE_STATES[currentProps.nextChapterId],
        currentProps.blend,
      );
      const visual = mixSceneVisual(
        SCENE_VISUALS[currentProps.activeChapterId],
        SCENE_VISUALS[currentProps.nextChapterId],
        currentProps.blend,
      );

      camera.position.set(
        dampNumber(camera.position.x, target.camera[0], 4.8, delta),
        dampNumber(camera.position.y, target.camera[1], 4.8, delta),
        dampNumber(camera.position.z, target.camera[2], 4.8, delta),
      );

      targetVector.set(target.target[0], target.target[1], target.target[2]);
      lookAtTarget.lerp(targetVector, 1 - Math.exp(-5 * delta));
      camera.lookAt(lookAtTarget);

      sceneRefs.root.rotation.y = dampNumber(
        sceneRefs.root.rotation.y,
        target.ringTilt * 0.28,
        3.8,
        delta,
      );
      sceneRefs.root.rotation.x = dampNumber(
        sceneRefs.root.rotation.x,
        -0.04 + target.columnBias * 0.05,
        3.8,
        delta,
      );

      ambientLight.intensity = dampNumber(
        ambientLight.intensity,
        0.66 + target.glow * 0.14,
        3.8,
        delta,
      );
      primaryLight.intensity = dampNumber(
        primaryLight.intensity,
        1.38 + target.glow * 0.26,
        3.8,
        delta,
      );
      accentLight.intensity = dampNumber(
        accentLight.intensity,
        0.74 + target.glow * 0.22,
        3.8,
        delta,
      );
      warmLight.intensity = dampNumber(
        warmLight.intensity,
        0.14 + visual.warmMix * 0.38,
        3.8,
        delta,
      );

      sceneRefs.paperGroup.position.x = dampNumber(
        sceneRefs.paperGroup.position.x,
        -0.34 + visual.paperVisibility * -0.1,
        4.4,
        delta,
      );
      sceneRefs.paperGroup.position.y = dampNumber(
        sceneRefs.paperGroup.position.y,
        0.9 + visual.paperVisibility * 0.22 + visual.paperLift * 0.08,
        4.4,
        delta,
      );
      sceneRefs.paperGroup.position.z = dampNumber(
        sceneRefs.paperGroup.position.z,
        1.12 + visual.paperVisibility * 0.38,
        4.4,
        delta,
      );
      sceneRefs.paperGroup.rotation.x = dampNumber(
        sceneRefs.paperGroup.rotation.x,
        -0.52 + visual.paperVisibility * 0.14,
        4.2,
        delta,
      );
      sceneRefs.paperGroup.rotation.y = dampNumber(
        sceneRefs.paperGroup.rotation.y,
        -0.32 + visual.paperVisibility * 0.08,
        4.2,
        delta,
      );
      sceneRefs.paperGroup.rotation.z = dampNumber(
        sceneRefs.paperGroup.rotation.z,
        0.18 - visual.paperLift * 0.04,
        4.2,
        delta,
      );
      sceneRefs.paperGroup.scale.setScalar(
        dampNumber(
          sceneRefs.paperGroup.scale.x,
          0.62 + visual.paperVisibility * 0.42,
          4.6,
          delta,
        ),
      );

      const paperSheetMaterial = sceneRefs.paperSheet.material as MeshPhysicalMaterial;
      paperSheetMaterial.opacity = dampNumber(
        paperSheetMaterial.opacity,
        0.04 + visual.paperVisibility * 0.92,
        4.8,
        delta,
      );
      paperSheetMaterial.emissiveIntensity = dampNumber(
        paperSheetMaterial.emissiveIntensity,
        0.04 + visual.paperScan * 0.18,
        4.8,
        delta,
      );

      const paperAuraMaterial = sceneRefs.paperAura.material as MeshBasicMaterial;
      paperAuraMaterial.opacity = dampNumber(
        paperAuraMaterial.opacity,
        0.02 + visual.paperVisibility * 0.18 + visual.paperScan * 0.12,
        4.6,
        delta,
      );

      const scanMaterial = sceneRefs.paperScanBeam.material as MeshBasicMaterial;
      const scanLoop = currentProps.reducedMotion
        ? 0.48
        : (elapsed * 0.42 + 0.14) % 1;
      const scanY = 1.18 - scanLoop * 2.34;
      sceneRefs.paperScanBeam.position.y = dampNumber(
        sceneRefs.paperScanBeam.position.y,
        scanY,
        5,
        delta,
      );
      sceneRefs.paperScanBeam.scale.x = dampNumber(
        sceneRefs.paperScanBeam.scale.x,
        0.92 + visual.paperScan * 0.16,
        4.6,
        delta,
      );
      scanMaterial.opacity = dampNumber(
        scanMaterial.opacity,
        visual.paperVisibility * (0.04 + visual.paperScan * 0.42),
        4.8,
        delta,
      );

      sceneRefs.paperAnswers.forEach((answer, index) => {
        const liftPulse = currentProps.reducedMotion
          ? 0.55
          : (Math.sin(elapsed * (0.88 + index * 0.06) + answer.phase) + 1) / 2;
        const liftProgress =
          visual.paperLift * (0.12 + liftPulse * 0.88) * answer.travel;
        const xTarget =
          MathUtils.lerp(answer.start.x, answer.target.x, liftProgress) +
          Math.sin(elapsed * 0.9 + answer.phase) * 0.04 * motionFactor;
        const yTarget =
          MathUtils.lerp(answer.start.y, answer.target.y, liftProgress) +
          Math.cos(elapsed * 1.05 + answer.phase) * 0.05 * motionFactor;
        const zTarget = MathUtils.lerp(answer.start.z, answer.target.z, liftProgress);

        answer.mesh.position.x = dampNumber(answer.mesh.position.x, xTarget, 4.8, delta);
        answer.mesh.position.y = dampNumber(answer.mesh.position.y, yTarget, 4.8, delta);
        answer.mesh.position.z = dampNumber(answer.mesh.position.z, zTarget, 4.8, delta);

        answer.mesh.scale.setScalar(
          dampNumber(
            answer.mesh.scale.x,
            0.74 + visual.paperVisibility * 0.2 + liftProgress * 0.62,
            5,
            delta,
          ),
        );

        const material = answer.mesh.material as MeshStandardMaterial;
        tempColor.copy(answer.warm ? warmNode : coolNode);
        material.color.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        material.emissive.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        material.opacity = dampNumber(
          material.opacity,
          visual.paperVisibility * (0.12 + liftProgress * 0.84),
          4.8,
          delta,
        );
        material.emissiveIntensity = 0.46 + liftProgress * (answer.warm ? 0.68 : 0.48);
      });

      tempColor.copy(coolSurface).lerp(warmSurface, visual.warmMix * 0.38);
      sceneRefs.terrainMaterial.color.lerp(
        tempColor,
        1 - Math.exp(-4.6 * delta),
      );
      tempColor.copy(coolEmission).lerp(warmEmission, visual.warmMix * 0.72);
      sceneRefs.terrainMaterial.emissive.lerp(
        tempColor,
        1 - Math.exp(-4.6 * delta),
      );
      sceneRefs.terrainMaterial.emissiveIntensity = 0.28 + target.glow * 0.2;
      sceneRefs.terrainMaterial.opacity = dampNumber(
        sceneRefs.terrainMaterial.opacity,
        0.64 + visual.terrainVisibility * 0.26,
        4.2,
        delta,
      );
      sceneRefs.terrainWireMaterial.opacity = dampNumber(
        sceneRefs.terrainWireMaterial.opacity,
        0.08 + visual.terrainVisibility * 0.18 + visual.scanOpacity * 0.08,
        4.2,
        delta,
      );
      (
        sceneRefs.terrainUnderlay.material as MeshBasicMaterial
      ).opacity = dampNumber(
        (sceneRefs.terrainUnderlay.material as MeshBasicMaterial).opacity,
        0.24 + visual.terrainVisibility * 0.12,
        4,
        delta,
      );

      for (
        let index = 0;
        index < sceneRefs.terrainPositions.count;
        index += 1
      ) {
        const baseX = sceneRefs.terrainBase[index * 3];
        const baseY = sceneRefs.terrainBase[index * 3 + 1];
        const baseZ = sceneRefs.terrainBase[index * 3 + 2];
        const height = computeTerrainHeight(
          baseX,
          baseZ,
          elapsed,
          motionFactor,
          visual,
        );
        sceneRefs.terrainPositions.setXYZ(index, baseX, baseY + height, baseZ);
      }
      sceneRefs.terrainPositions.needsUpdate = true;
      (sceneRefs.terrainSurface.geometry as PlaneGeometry).computeVertexNormals();

      sceneRefs.scanRings.forEach((ring, index) => {
        const material = ring.material as MeshStandardMaterial;
        const radiusMotion =
          0.94 +
          index * 0.08 +
          visual.scanOpacity * 0.22 +
          Math.sin(elapsed * (0.45 + index * 0.16)) * 0.03 * motionFactor;
        ring.scale.setScalar(
          dampNumber(ring.scale.x, radiusMotion, 4.2, delta),
        );
        ring.position.y = dampNumber(
          ring.position.y,
          0.05 + index * 0.08 + visual.activePath * 0.04,
          4.2,
          delta,
        );
        ring.rotation.z += delta * (0.12 + index * 0.05) * motionFactor;
        material.opacity = dampNumber(
          material.opacity,
          0.06 + visual.scanOpacity * (index === 0 ? 0.42 : 0.24),
          4.2,
          delta,
        );
      });

      sceneRefs.hotspots.forEach((hotspot, hotspotIndex) => {
        const feature = TERRAIN_FEATURES[hotspot.featureIndex];
        const height =
          computeTerrainHeight(
            feature.x,
            feature.z,
            elapsed,
            motionFactor,
            visual,
          ) + 0.08;
        const negative = feature.amplitude < 0;
        const critical = hotspot.featureIndex === 4;
        const focusBoost =
          hotspotIndex === 3 ? visual.hotspotFocus : visual.hotspotFocus * 0.44;
        const stemHeight =
          0.58 +
          Math.abs(feature.amplitude) *
            (negative ? 0.52 + focusBoost * 0.18 : 0.42) *
            visual.hotspotOpacity;

        hotspot.group.position.x = feature.x;
        hotspot.group.position.z = feature.z;
        hotspot.group.position.y = dampNumber(
          hotspot.group.position.y,
          height,
          5,
          delta,
        );
        hotspot.group.rotation.y += delta * (0.2 + hotspotIndex * 0.05) * motionFactor;

        hotspot.stem.scale.y = dampNumber(hotspot.stem.scale.y, stemHeight, 5, delta);
        hotspot.stem.position.y = dampNumber(
          hotspot.stem.position.y,
          stemHeight / 2,
          5,
          delta,
        );
        hotspot.cap.position.y = dampNumber(
          hotspot.cap.position.y,
          stemHeight,
          5,
          delta,
        );
        hotspot.cap.scale.setScalar(
          dampNumber(
            hotspot.cap.scale.x,
            0.8 +
              (critical ? 0.45 : 0.18) +
              Math.sin(elapsed * 1.4 + hotspotIndex) * 0.04 * motionFactor,
            5,
            delta,
          ),
        );
        hotspot.ring.scale.setScalar(
          dampNumber(
            hotspot.ring.scale.x,
            0.7 + (critical ? 0.56 : 0.18) + visual.hotspotOpacity * 0.22,
            4.6,
            delta,
          ),
        );

        const stemMaterial = hotspot.stem.material as MeshPhysicalMaterial;
        const capMaterial = hotspot.cap.material as MeshStandardMaterial;
        const ringMaterial = hotspot.ring.material as MeshBasicMaterial;
        tempColor
          .copy(negative ? warmNode : coolNode)
          .lerp(alertNode, critical ? visual.activePath * 0.74 : 0);
        stemMaterial.color.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        stemMaterial.emissive.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        stemMaterial.opacity = dampNumber(
          stemMaterial.opacity,
          0.16 + visual.hotspotOpacity * (negative ? 0.44 : 0.28),
          4.8,
          delta,
        );
        capMaterial.color.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        capMaterial.emissive.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        capMaterial.opacity = dampNumber(
          capMaterial.opacity,
          0.32 + visual.hotspotOpacity * (negative ? 0.56 : 0.3),
          4.8,
          delta,
        );
        ringMaterial.color.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        ringMaterial.opacity = dampNumber(
          ringMaterial.opacity,
          0.12 + visual.hotspotOpacity * (critical ? 0.5 : 0.22),
          4.8,
          delta,
        );
      });

      sceneRefs.constellationGroup.position.y = dampNumber(
        sceneRefs.constellationGroup.position.y,
        0.38 + visual.constellationLift * 0.52,
        4.4,
        delta,
      );
      sceneRefs.constellationGroup.position.z = dampNumber(
        sceneRefs.constellationGroup.position.z,
        0.18 - visual.constellationVisibility * 0.22,
        4.4,
        delta,
      );
      sceneRefs.constellationGroup.rotation.y +=
        delta * (0.08 + visual.activePath * 0.04) * motionFactor;

      sceneRefs.constellationNodes.forEach((node, index) => {
        const base = CONSTELLATION_BASE_POSITIONS[index];
        const pathNode = ACTIVE_NODE_SET.has(index);
        const focusNode = index === 4;
        const xTarget =
          base.x * (0.7 + visual.constellationVisibility * 0.42) +
          Math.sin(elapsed * 0.42 + index) * 0.04 * motionFactor;
        const yTarget =
          base.y +
          Math.sin(elapsed * 0.78 + index * 0.62) * 0.08 * motionFactor +
          visual.constellationLift * 0.18;
        const zTarget =
          base.z * (0.74 + visual.modulesVisibility * 0.12) +
          Math.cos(elapsed * 0.36 + index) * 0.03 * motionFactor;

        node.position.x = dampNumber(node.position.x, xTarget, 4.6, delta);
        node.position.y = dampNumber(node.position.y, yTarget, 4.6, delta);
        node.position.z = dampNumber(node.position.z, zTarget, 4.6, delta);

        const scale =
          (focusNode ? 1.15 : pathNode ? 0.96 : 0.84) +
          visual.constellationVisibility * 0.26 +
          (focusNode ? visual.activePath * 0.26 : 0);
        node.scale.setScalar(dampNumber(node.scale.x, scale, 5, delta));

        const material = node.material as MeshStandardMaterial;
        tempColor
          .copy(pathNode ? warmNode : coolNode)
          .lerp(alertNode, focusNode ? visual.activePath * 0.82 : 0);
        material.color.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        material.emissive.lerp(tempColor, 1 - Math.exp(-4.6 * delta));
        material.emissiveIntensity = focusNode
          ? 0.92 + visual.activePath * 0.5
          : 0.62 + visual.constellationVisibility * 0.22;
        material.opacity = dampNumber(
          material.opacity,
          0.06 +
            visual.constellationVisibility *
              (pathNode ? 0.88 : 0.46 + visual.modulesVisibility * 0.08),
          4.8,
          delta,
        );
      });

      CONSTELLATION_EDGE_PAIRS.forEach(([fromIndex, toIndex], index) => {
        const from = sceneRefs.constellationNodes[fromIndex].position;
        const to = sceneRefs.constellationNodes[toIndex].position;
        sceneRefs.constellationEdgesPositions.setXYZ(index * 2, from.x, from.y, from.z);
        sceneRefs.constellationEdgesPositions.setXYZ(
          index * 2 + 1,
          to.x,
          to.y,
          to.z,
        );
      });
      sceneRefs.constellationEdgesPositions.needsUpdate = true;

      CONSTELLATION_ACTIVE_EDGE_PAIRS.forEach(([fromIndex, toIndex], index) => {
        const from = sceneRefs.constellationNodes[fromIndex].position;
        const to = sceneRefs.constellationNodes[toIndex].position;
        sceneRefs.constellationActiveEdgesPositions.setXYZ(
          index * 2,
          from.x,
          from.y,
          from.z,
        );
        sceneRefs.constellationActiveEdgesPositions.setXYZ(
          index * 2 + 1,
          to.x,
          to.y,
          to.z,
        );
      });
      sceneRefs.constellationActiveEdgesPositions.needsUpdate = true;

      (
        sceneRefs.constellationEdges.material as LineBasicMaterial
      ).opacity = dampNumber(
        (sceneRefs.constellationEdges.material as LineBasicMaterial).opacity,
        0.04 + visual.constellationVisibility * 0.28,
        4.4,
        delta,
      );
      (
        sceneRefs.constellationActiveEdges.material as LineBasicMaterial
      ).opacity = dampNumber(
        (sceneRefs.constellationActiveEdges.material as LineBasicMaterial).opacity,
        visual.activePath * 0.86,
        4.4,
        delta,
      );

      sceneRefs.moduleGroup.position.y = dampNumber(
        sceneRefs.moduleGroup.position.y,
        0.56 + visual.modulesVisibility * 0.16,
        4.2,
        delta,
      );
      sceneRefs.moduleGroup.rotation.y += delta * 0.05 * motionFactor;

      sceneRefs.modulePanels.forEach((panel, index) => {
        const angle = MODULE_ANGLES[index];
        const radius = target.moduleArc * (0.82 + visual.modulesSpread * 0.18);
        const xTarget = Math.sin(angle) * radius;
        const yTarget =
          Math.cos(angle * 1.2) * target.moduleLift * 0.46 +
          0.08 +
          visual.modulesVisibility * 0.08;
        const zTarget = -0.9 + Math.cos(angle) * 0.42;

        panel.group.position.x = dampNumber(panel.group.position.x, xTarget, 4.6, delta);
        panel.group.position.y = dampNumber(panel.group.position.y, yTarget, 4.6, delta);
        panel.group.position.z = dampNumber(panel.group.position.z, zTarget, 4.6, delta);
        panel.group.rotation.y = dampNumber(
          panel.group.rotation.y,
          -angle * 0.14,
          4.6,
          delta,
        );
        panel.group.rotation.x = dampNumber(
          panel.group.rotation.x,
          -0.06 + visual.modulesVisibility * 0.04,
          4.6,
          delta,
        );

        const shellMaterial = panel.shell.material as MeshPhysicalMaterial;
        shellMaterial.opacity = dampNumber(
          shellMaterial.opacity,
          0.06 + visual.modulesVisibility * 0.54,
          4.6,
          delta,
        );
        shellMaterial.emissiveIntensity = 0.08 + visual.modulesVisibility * 0.24;

        panel.lines.forEach((line, lineIndex) => {
          const lineMaterial = line.material as MeshBasicMaterial;
          lineMaterial.opacity = dampNumber(
            lineMaterial.opacity,
            0.12 + visual.modulesVisibility * (lineIndex === 0 ? 0.78 : 0.42),
            4.6,
            delta,
          );
        });
      });

      const sparklePositions = sceneRefs.sparkleField.geometry.getAttribute(
        "position",
      ) as BufferAttribute;
      for (let index = 0; index < sceneRefs.sparklePhase.length; index += 1) {
        const baseX = sceneRefs.sparkleBase[index * 3];
        const baseY = sceneRefs.sparkleBase[index * 3 + 1];
        const baseZ = sceneRefs.sparkleBase[index * 3 + 2];
        const phase = sceneRefs.sparklePhase[index];
        sparklePositions.setXYZ(
          index,
          baseX + Math.sin(elapsed * 0.14 + phase) * 0.08,
          baseY + Math.sin(elapsed * 0.28 + phase) * 0.12 * motionFactor,
          baseZ + Math.cos(elapsed * 0.18 + phase) * 0.08,
        );
      }
      sparklePositions.needsUpdate = true;
      const sparkleMaterial = sceneRefs.sparkleField.material as PointsMaterial;
      sparkleMaterial.opacity = dampNumber(
        sparkleMaterial.opacity,
        0.18 + target.glow * 0.16 + visual.constellationVisibility * 0.12,
        3.8,
        delta,
      );

      (
        sceneRefs.backdrop.material as MeshBasicMaterial
      ).opacity = dampNumber(
        (sceneRefs.backdrop.material as MeshBasicMaterial).opacity,
        0.18 + visual.warmMix * 0.08,
        3.8,
        delta,
      );

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);

      scene.traverse((object: Object3D) => {
        const meshLike = object as Object3D & {
          geometry?: { dispose: () => void };
          material?: unknown;
        };
        meshLike.geometry?.dispose();
        disposeMaterial(meshLike.material);
      });

      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [renderMode]);

  return <div ref={containerRef} className={cn("h-full w-full", className)} />;
}
