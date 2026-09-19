/**
 * Insights → things the UI can draw. The badge logic lives with the
 * wireframe entity so the wireframe dialog can use it too; this module keeps
 * the Author feature's import path.
 */
export {
  hasErrors,
  healthBadges,
  isSlow,
  problemVisuals,
  seconds,
  SLOW_VISUAL_MS,
} from '@/entities/definition';
