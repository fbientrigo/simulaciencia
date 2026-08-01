/**
 * One list, one dispose loop.
 *
 * The decay chamber proved this pattern: anything holding GPU memory is pushed
 * into a single registry at construction time, and teardown is one pass over
 * it. That makes `dispose()` testable without a WebGL context, because the
 * registry is ordinary JavaScript — which is exactly why the counting detector
 * reuses it rather than growing a second, subtly different teardown path.
 */

export interface Disposable {
  dispose(): void;
}

export interface DisposalRegistry {
  /** Register a resource and return it, so it can be used inline. */
  track<T extends Disposable>(resource: T): T;
  /** Dispose everything registered, in registration order, then forget it. */
  disposeAll(): void;
  /** How many resources are currently registered. */
  readonly size: number;
}

export function createDisposalRegistry(): DisposalRegistry {
  const resources: Disposable[] = [];
  return {
    track<T extends Disposable>(resource: T): T {
      resources.push(resource);
      return resource;
    },
    disposeAll(): void {
      for (const resource of resources) resource.dispose();
      resources.length = 0;
    },
    get size(): number {
      return resources.length;
    },
  };
}
