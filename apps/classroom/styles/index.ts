/**
 * Slidev auto-loads `styles/index.ts` for the local deck. Importing the token
 * sheet here is the whole integration: SimulaCiencia styles only apply inside
 * `.sc-root`, so the Slidev theme keeps its own typography untouched.
 */
import '@simulaciencia/theme/all.css';
