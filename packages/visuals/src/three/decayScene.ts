import type { RadioactiveDecaySnapshot } from '@simulaciencia/case-radioactive-decay';
import * as THREE from 'three';

/**
 * The Three.js chamber, written as a plain object with an explicit lifecycle.
 *
 * There is no wrapper library on purpose. Scene construction, per-frame update
 * and disposal are three ordinary functions you can read top to bottom, and
 * `dispose()` is unit-testable without a WebGL context because every geometry
 * and material is tracked in one array.
 *
 * The scene renders a population of abstract simulated objects in a bounded
 * box. It is deliberately not atomic imagery — no nucleus, no orbits, no glow.
 */

/** Everything the component may do to a live scene. */
export interface DecayScene {
  /** Push a new snapshot. Cheap: writes instance attributes, allocates nothing. */
  update(snapshot: RadioactiveDecaySnapshot): void;
  /** Draw one frame. `elapsed` only drives idle rotation, never simulation. */
  render(elapsedSeconds: number): void;
  /** Handle a container resize. Safe to call with unchanged dimensions. */
  resize(width: number, height: number): void;
  /** Release every GPU resource. Idempotent. */
  dispose(): void;
  /** True once `dispose()` has run. */
  readonly disposed: boolean;
}

/**
 * A renderer seam.
 *
 * Production passes nothing and gets a real `WebGLRenderer`. Tests pass a stub,
 * which is what lets the disposal test run in jsdom where WebGL does not exist.
 */
export interface RendererLike {
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(ratio: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
  domElement: HTMLCanvasElement;
}

export type RendererFactory = (canvas: HTMLCanvasElement) => RendererLike;

export interface DecaySceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio?: number;
  /** Injected in tests. Defaults to a real WebGL 2 renderer. */
  readonly rendererFactory?: RendererFactory;
  /** Slow idle rotation, radians per second. Set to 0 for a frozen capture. */
  readonly spinRate?: number;
}

const ALIVE_COLOR = new THREE.Color('#4f7cff'); // theoretical / still present
const DECAYING_COLOR = new THREE.Color('#f43f5e'); // the decay event itself
const DECAYED_COLOR = new THREE.Color('#8b5cf6'); // already decayed, dimmed

const ALIVE_SCALE = 1;
const DECAYED_SCALE = 0.35;
/** How long, in real seconds, a decay event stays highlighted. */
const EVENT_HIGHLIGHT_SECONDS = 0.45;

const defaultRendererFactory: RendererFactory = (canvas) =>
  new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

/**
 * Is WebGL 2 usable here?
 *
 * Called before constructing anything, so a machine without WebGL renders the
 * 2D fallback rather than throwing inside a Vue lifecycle hook.
 */
export function supportsWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    // Truthiness, not `!== null`: jsdom returns `undefined` for an
    // unimplemented context type, which a null check would read as success.
    return Boolean(probe.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function createDecayScene(options: DecaySceneOptions): DecayScene {
  const { canvas, width, height } = options;
  const spinRate = options.spinRate ?? 0.12;
  const factory = options.rendererFactory ?? defaultRendererFactory;

  // One list, one dispose loop. Anything added to the scene that owns GPU
  // memory MUST be pushed here at construction time.
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(resource: T): T => {
    disposables.push(resource);
    return resource;
  };

  const renderer = factory(canvas);
  renderer.setPixelRatio(options.pixelRatio ?? 1);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, width / Math.max(1, height), 0.1, 100);
  camera.position.set(3.2, 2.4, 3.6);
  camera.lookAt(0, 0, 0);

  // Two lights are enough for matte spheres; no environment map, no shadows.
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  // The chamber: an edges-only box, so it reads as a boundary and never
  // occludes the population inside it.
  const chamberBox = track(new THREE.BoxGeometry(2, 2, 2));
  const chamberEdges = track(new THREE.EdgesGeometry(chamberBox));
  const chamberMaterial = track(
    new THREE.LineBasicMaterial({ color: 0x8b97ab, transparent: true, opacity: 0.55 }),
  );
  const chamber = new THREE.LineSegments(chamberEdges, chamberMaterial);
  scene.add(chamber);

  // One instanced mesh for the whole population: a single draw call whatever
  // N₀ is, and the only per-frame work is writing matrices and colours.
  const particleGeometry = track(new THREE.SphereGeometry(0.035, 12, 8));
  const particleMaterial = track(
    new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05, transparent: true }),
  );

  let capacity = 0;
  let instances: THREE.InstancedMesh | null = null;
  const scratchMatrix = new THREE.Matrix4();
  const scratchPosition = new THREE.Vector3();
  const scratchQuaternion = new THREE.Quaternion();
  const scratchScale = new THREE.Vector3();

  /** Real-time countdown per particle for the decay-event highlight. */
  let highlightUntil = new Float64Array(0);
  let clockSeconds = 0;
  let disposed = false;

  function ensureCapacity(count: number): THREE.InstancedMesh {
    if (instances !== null && capacity >= count) return instances;
    if (instances !== null) {
      scene.remove(instances);
      instances.dispose();
    }
    capacity = count;
    const mesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, Math.max(1, count));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    instances = mesh;
    highlightUntil = new Float64Array(Math.max(1, count));
    return mesh;
  }

  function update(snapshot: RadioactiveDecaySnapshot): void {
    if (disposed) return;
    const particles = snapshot.particles;
    const mesh = ensureCapacity(particles.length);
    mesh.count = particles.length;

    for (const id of snapshot.justDecayed) {
      if (id < highlightUntil.length) highlightUntil[id] = clockSeconds + EVENT_HIGHLIGHT_SECONDS;
    }

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (p === undefined) continue;
      const highlighted = !p.alive && (highlightUntil[i] ?? 0) > clockSeconds;
      const scale = p.alive ? ALIVE_SCALE : highlighted ? 1.6 : DECAYED_SCALE;

      scratchPosition.set(p.x, p.y, p.z);
      scratchQuaternion.identity();
      scratchScale.setScalar(scale);
      scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
      mesh.setMatrixAt(i, scratchMatrix);
      mesh.setColorAt(i, p.alive ? ALIVE_COLOR : highlighted ? DECAYING_COLOR : DECAYED_COLOR);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  }

  function render(elapsedSeconds: number): void {
    if (disposed) return;
    clockSeconds += elapsedSeconds;
    if (spinRate !== 0) {
      // Camera orbit only — purely cosmetic and never fed back into the model.
      const radius = 4.4;
      const angle = clockSeconds * spinRate;
      camera.position.set(Math.cos(angle) * radius, 2.2, Math.sin(angle) * radius);
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

    if (instances !== null) {
      scene.remove(instances);
      instances.dispose();
      instances = null;
    }
    scene.remove(chamber);
    for (const resource of disposables) resource.dispose();
    disposables.length = 0;
    scene.clear();
    renderer.dispose();
    highlightUntil = new Float64Array(0);
  }

  return {
    update,
    render,
    resize,
    dispose,
    get disposed(): boolean {
      return disposed;
    },
  };
}
