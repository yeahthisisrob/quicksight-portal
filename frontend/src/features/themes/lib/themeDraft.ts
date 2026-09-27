/**
 * A theme being drafted in the browser: the same shape the API takes, with
 * the checks it will make shown before anyone presses Create.
 *
 * Pure.
 */
import type { ThemeDraft } from '@/shared/api/modules/themes';

const HEX = /^#[0-9A-F]{6}$/i;
const MIN_DATA_COLORS = 2;
export const MAX_DATA_COLORS = 20;
/** The same cap the API holds a picture to. */
const MAX_IMAGE_BYTES = 3_500_000;

/** The roles the editor offers; the rest keep what the base theme has. */
export const EDITABLE_ROLES = [
  'PrimaryBackground',
  'PrimaryForeground',
  'SecondaryBackground',
  'SecondaryForeground',
  'Accent',
  'AccentForeground',
] as const;

export const BLANK_DRAFT: ThemeDraft = {
  name: '',
  baseThemeId: 'CLASSIC',
  dataColors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B'],
  uiColors: { PrimaryBackground: '#FFFFFF', PrimaryForeground: '#1B1B1B', Accent: '#1F77B4' },
};

/** What stops the draft being created, in words; empty when it can be. */
export function draftProblems(draft: ThemeDraft): string[] {
  const problems: string[] = [];
  if (!draft.name.trim()) problems.push('Give it a name.');
  if (draft.dataColors.length < MIN_DATA_COLORS) {
    problems.push(`At least ${MIN_DATA_COLORS} data colors are needed.`);
  }
  if (draft.dataColors.length > MAX_DATA_COLORS) {
    problems.push(`At most ${MAX_DATA_COLORS} data colors.`);
  }
  if (draft.dataColors.some((c: string) => !HEX.test(c))) {
    problems.push('Every data color must be a hex color like #1F77B4.');
  }
  const badRoles = Object.entries<string>(draft.uiColors ?? {})
    .filter(([, c]) => !HEX.test(c))
    .map(([role]) => role);
  if (badRoles.length) problems.push(`Not hex colors: ${badRoles.join(', ')}.`);
  return problems;
}

/** A picture as the data URL the API takes, refused when too large or not an image. */
export function imageProblem(file: { type: string; size: number }): string | null {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
    return 'Use a PNG, JPEG, GIF or WebP picture.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `The picture is ${(file.size / 1_000_000).toFixed(1)} MB; the limit is 3.5 MB.`;
  }
  return null;
}
