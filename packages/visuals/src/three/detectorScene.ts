import type { PoissonCountingSnapshot } from '@simulaciencia/case-poisson-counting';
import * as THREE from 'three';
import { createDisposalRegistry, type Disposable } from './disposal.ts';

/**
 * A GENERIC counting detector, written the same way as the decay chamber: a
 * plain object with an explicit lifecycle and no wrapper framework.
 *
 * It is deliberately not any real apparatus. There is a source surface, a
 * bounded sensitive volume, straight trajectories and a flash where a particle
 * interacts. There is no transport physics, no tracking, no geometry
 * description language and no custom shader — the scene exists to make "an
 * event happened, and we counted it" visible, nothing more.
 *
 * Only the CURRENT observation window is in the scene. Past windows live in the
 * count history and the histogram, which are 2D and much cheaper.
 */

export interface DetectorScene {
  /** Push a new snapshot. Detects a new window and restarts the reveal. */
  update(snapshot: PoissonCountingSnapshot): void;
  /** Draw one frame. `elapsed` drives the reveal and the orbit, never the model. */
  render(elapsedSeconds: number): void;
  resize(width: number, height: number): void;
  /** Release every GPU resource. Idempotent. */
  dispose(): void;
  readonly disposed: boolean;
  /** Idle-orbit speed in radians/second. 0 means the camera is frozen. */
  readonly spinRate: number;
  setSpinRate(rate: number): void;
  /**
   * When true, a new window appears fully formed: no particle travels, every
   * interaction is lit at once. This is the `prefers-reduced-motion` path, and
   * it changes nothing statistical — the same events, at the same positions.
   */
  readonly instantReveal: boolean;
  setInstantReveal(instant: boolean): void;
  /** Fraction of the current window's reveal already played, in `[0, 1]`. */
  readonly revealProgress: number;
}

/**
 * A renderer seam, identical in shape to the decay chamber's.
 *
 * Production passes nothing and gets a real `WebGLRenderer`; tests pass a stub,
 * which is what lets the disposal test run in jsdom where WebGL does not exist.
 */
export interface DetectorRendererLike {
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(ratio: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
  domElement: HTMLCanvasElement;
}

export type DetectorRendererFactory = (canvas: HTMLCanvasElement) => DetectorRendererLike;

export interface DetectorSceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio?: number;
  readonly rendererFactory?: DetectorRendererFactory;
  /** Slow idle rotation, radians per second. 0 for a frozen capture. */
  readonly spinRate?: number;
  /** Start in the reduced-motion reveal mode. */
  readonly instantReveal?: boolean;
}

/** Real seconds one observation window takes to play out on screen. */
const REVEAL_SECONDS = 0.9;
/** How long an interaction flash stays at full brightness after it lands. */
const FLASH_SECONDS = 0.55;
/** Hard ceiling on simultaneously drawn events; μ ≤ 20 never approaches it. */
const MAX_DRAWN_EVENTS = 256;

const BEAM_COLOR = new THREE.Color('#8b5cf6');
const FLASH_COLOR = new THREE.Color('#f59e0b');
const SETTLED_COLOR = new THREE.Color('#4f7cff');

/** Where particles enter from: a plane just outside the volume on −x. */
const SOURCE_X = -1.75;

const defaultRendererFactory: DetectorRendererFactory = (canvas) =>
  new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

export function createDetectorScene(options: DetectorSceneOptions): DetectorScene {
  const { canvas, width, height } = options;
  let spinRate = options.spinRate ?? 0.1;
  let instantReveal = options.instantReveal ?? false;
  const factory = options.rendererFactory ?? defaultRendererFactory;

  const disposables = createDisposalRegistry();
  const track = <T extends Disposable>(resource: T): T => disposables.track(resource);

  const renderer = factory(canvas);
  renderer.setPixelRatio(options.pixelRatio ?? 1);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, width / Math.max(1, height), 0.1, 100);
  const CAMERA_RADIUS = 4.6;
  const CAMERA_HEIGHT = 1.9;
  camera.position.set(CAMERA_RADIUS * 0.55, CAMERA_HEIGHT, CAMERA_RADIUS * 0.85);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(-3, 5, 4);
  scene.add(keyLight);

  // The sensitive volume: edges only, so it reads as a boundary and never
  // hides the events inside it.
  const volumeBox = track(new THREE.BoxGeometry(2, 2, 2));
  const volumeEdges = track(new THREE.EdgesGeometry(volumeBox));
  const volumeMaterial = track(
    new THREE.LineBasicMaterial({ color: 0x8b97ab, transparent: true, opacity: 0.55 }),
  );
  const volume = new THREE.LineSegments(volumeEdges, volumeMaterial);
  scene.add(volume);

  // The entry surface: one flat quad the particles come from.
  const sourceGeometry = track(new THREE.PlaneGeometry(1.6, 1.6));
  const sourceMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0x4f7cff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    }),
  );
  const source = new THREE.Mesh(sourceGeometry, sourceMaterial);
  source.position.set(SOURCE_X, 0, 0);
  source.rotation.y = Math.PI / 2;
  scene.add(source);

  // Trajectories: one thin segment per event, all in one geometry so the whole
  // window is a single draw call whatever K turns out to be.
  const trackGeometry = track(new THREE.BufferGeometry());
  const trackPositions = new Float32Array(MAX_DRAWN_EVENTS * 2 * 3);
  trackGeometry.setAttribute('position', new THREE.BufferAttribute(trackPositions, 3));
  const trackMaterial = track(
    new THREE.LineBasicMaterial({ color: BEAM_COLOR, transparent: true, opacity: 0.75 }),
  );
  const tracks = new THREE.LineSegments(trackGeometry, trackMaterial);
  scene.add(tracks);

  // Interaction flashes: one instanced sphere mesh, allocated once at capacity.
  const flashGeometry = track(new THREE.SphereGeometry(0.055, 14, 10));
  const flashMaterial = track(
    new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05, transparent: true }),
  );
  const flashes = track(new THREE.InstancedMesh(flashGeometry, flashMaterial, MAX_DRAWN_EVENTS));
  flashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flashes.count = 0;
  scene.add(flashes);

  const scratchMatrix = new THREE.Matrix4();
  const scratchPosition = new THREE.Vector3();
  const scratchQuaternion = new THREE.Quaternion();
  const scratchScale = new THREE.Vector3();

  let events: PoissonCountingSnapshot['currentEvents'] = [];
  /** Identifies the window on screen, so a re-render does not restart it. */
  let currentWindow = -1;
  let revealClock = 0;
  let orbitClock = 0;
  let disposed = false;

  function hideEverything(): void {
    flashes.count = 0;
    trackGeometry.setDrawRange(0, 0);
  }

  function update(snapshot: PoissonCountingSnapshot): void {
    if (disposed) return;
    if (snapshot.revealedWindows === currentWindow) return;
    currentWindow = snapshot.revealedWindows;
    events = snapshot.currentEvents.slice(0, MAX_DRAWN_EVENTS);
    // A brand-new window restarts the reveal; reduced motion skips straight to
    // the finished picture rather than skipping the events themselves.
    revealClock = instantReveal ? REVEAL_SECONDS : 0;
    hideEverything();
    layout();
  }

  /**
   * Position every visible mark for the current reveal progress.
   *
   * An event is "arrived" once the reveal clock passes its own phase inside the
   * window, so the events appear in the order and the relative spacing the
   * exponential waiting times produced. Before it arrives, its trajectory is
   * drawn partially — the particle is still travelling in.
   */
  function layout(): void {
    const progress = instantReveal ? 1 : Math.min(1, revealClock / REVEAL_SECONDS);

    let segments = 0;
    let drawn = 0;

    for (let i = 0; i < events.length; i += 1) {
      const event = events[i];
      if (event === undefined) continue;

      // The particle starts travelling a little before its arrival phase, so a
      // fast window still shows motion rather than pure popping.
      const arrivedAt = event.phase;
      const travelStart = Math.max(0, arrivedAt - 0.25);
      const arrived = progress >= arrivedAt;
      const travel = arrived
        ? 1
        : Math.max(0, (progress - travelStart) / Math.max(1e-6, arrivedAt - travelStart));
      if (travel <= 0) continue;

      const headX = SOURCE_X + (event.x - SOURCE_X) * travel;
      const headY = event.y * travel;
      const headZ = event.z * travel;

      const base = segments * 6;
      trackPositions[base] = SOURCE_X;
      trackPositions[base + 1] = 0;
      trackPositions[base + 2] = 0;
      trackPositions[base + 3] = headX;
      trackPositions[base + 4] = headY;
      trackPositions[base + 5] = headZ;
      segments += 1;

      if (!arrived) continue;

      // Flash brightly on landing, then settle into a steady marker so the
      // final picture shows the whole window's K interactions at once.
      const sinceArrival = instantReveal
        ? FLASH_SECONDS
        : Math.max(0, (progress - arrivedAt) * REVEAL_SECONDS);
      const hot = sinceArrival < FLASH_SECONDS;
      const scale = hot ? 1 + 0.9 * (1 - sinceArrival / FLASH_SECONDS) : 1;

      scratchPosition.set(event.x, event.y, event.z);
      scratchQuaternion.identity();
      scratchScale.setScalar(scale);
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
      flashes.setMatrixAt(drawn, scratchMatrix);
      flashes.setColorAt(drawn, hot ? FLASH_COLOR : SETTLED_COLOR);
      drawn += 1;
    }

    flashes.count = drawn;
    flashes.instanceMatrix.needsUpdate = true;
    if (flashes.instanceColor !== null) flashes.instanceColor.needsUpdate = true;

    trackGeometry.setDrawRange(0, segments * 2);
    const attribute = trackGeometry.getAttribute('position');
    attribute.needsUpdate = true;
  }

  function render(elapsedSeconds: number): void {
    if (disposed) return;
    orbitClock += elapsedSeconds;
    if (!instantReveal && revealClock < REVEAL_SECONDS) {
      revealClock = Math.min(REVEAL_SECONDS, revealClock + elapsedSeconds);
      layout();
    }
    if (spinRate !== 0) {
      // Cosmetic camera orbit only, never fed back into the model.
      const angle = orbitClock * spinRate + 0.9;
      camera.position.set(
        Math.cos(angle) * CAMERA_RADIUS,
        CAMERA_HEIGHT,
        Math.sin(angle) * CAMERA_RADIUS,
      );
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  }

  function resize(nextWidth: number, nextHeight: number): void {
    if (disposed) return;
    const w = Math.max(1, Math.floor(nextWidth));
    const h = Math.max(1, Math.floor(nextHeight));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    scene.remove(volume);
    scene.remove(source);
    scene.remove(tracks);
    scene.remove(flashes);
    disposables.disposeAll();
    scene.clear();
    renderer.dispose();
    events = [];
  }

  return {
    update,
    render,
    resize,
    dispose,
    setSpinRate(rate: number): void {
      if (disposed) return;
      spinRate = rate;
    },
    setInstantReveal(instant: boolean): void {
      if (disposed) return;
      instantReveal = instant;
      if (instant) revealClock = REVEAL_SECONDS;
      layout();
    },
    get disposed(): boolean {
      return disposed;
    },
    get spinRate(): number {
      return spinRate;
    },
    get instantReveal(): boolean {
      return instantReveal;
    },
    get revealProgress(): number {
      return instantReveal ? 1 : Math.min(1, revealClock / REVEAL_SECONDS);
    },
  };
}
