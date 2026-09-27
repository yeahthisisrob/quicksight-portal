/**
 * A theme as QuickSight takes it: an ARN as given, one QuickSight ships by
 * name (they live in the `aws` account), a custom one by id in this account.
 */
import { settingsStore } from '../settings/SettingsStore';

export const QUICKSIGHT_THEMES = ['CLASSIC', 'MIDNIGHT', 'SEASIDE', 'RAINIER'] as const;

export function themeArnOf(
  theme: string,
  accountId = process.env.AWS_ACCOUNT_ID || '',
  region = process.env.AWS_REGION || 'us-east-1'
): string {
  const value = theme.trim();
  if (value.startsWith('arn:')) return value;
  const upper = value.toUpperCase();
  if ((QUICKSIGHT_THEMES as readonly string[]).includes(upper)) {
    return `arn:aws:quicksight::aws:theme/${upper}`;
  }
  return `arn:aws:quicksight:${region}:${accountId}:theme/${value}`;
}

/** The theme new assets wear (Settings, authoring.defaultTheme), as an ARN; none when unset. */
export function defaultThemeArn(
  get = (k: string) => settingsStore.getString(k)
): string | undefined {
  const theme = get('authoring.defaultTheme')?.trim();
  return theme ? themeArnOf(theme) : undefined;
}
