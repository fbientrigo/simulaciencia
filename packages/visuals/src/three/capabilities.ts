/**
 * Renderer capability probing, shared by every 3D scene in the project.
 *
 * Extracted from `decayScene.ts` when the second scene needed the identical
 * check — that is the bar for pulling something out of a scene file. Cameras,
 * detectors, entities and scene graphs are NOT shared: the decay chamber and
 * the counting detector genuinely want different ones, and a premature
 * abstraction over them would cost more than it saves.
 */

/**
 * Is WebGL 2 usable here?
 *
 * Called before constructing anything, so a machine without WebGL renders a 2D
 * fallback rather than throwing inside a Vue lifecycle hook.
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
