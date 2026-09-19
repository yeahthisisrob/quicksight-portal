/**
 * Raw colour scales. Nothing in the app imports these directly: components
 * use semantic tokens (tokens/semantic.ts) or the MUI theme built from them.
 *
 * The scales follow the visual language of AWS Cloudscape, the design system
 * behind SageMaker Unified Studio: a single strong blue for actions, cool
 * greys for chrome, and status hues that read at small sizes.
 */
export const blue = {
  100: '#F2F8FD',
  200: '#D1E4F5',
  300: '#89BDEE',
  400: '#539FE5',
  500: '#0972D3',
  600: '#033160',
  700: '#001F3F',
} as const;

export const grey = {
  0: '#FFFFFF',
  50: '#FBFBFB',
  100: '#F2F3F3',
  150: '#E9EBED',
  200: '#D5DBDB',
  300: '#C6C6CD',
  400: '#8D99A8',
  500: '#7D8998',
  600: '#5F6B7A',
  700: '#414D5C',
  800: '#232F3E',
  850: '#192534',
  900: '#0F1B2A',
  950: '#000716',
} as const;

export const green = {
  100: '#F2FCF3',
  300: '#8CEB9C',
  500: '#037F0C',
  600: '#00580E',
} as const;

export const red = {
  100: '#FFF7F7',
  300: '#FFB2B2',
  500: '#D91515',
  600: '#8C0F0F',
} as const;

export const yellow = {
  100: '#FFFCE8',
  300: '#FFE457',
  500: '#8D6605',
  600: '#5F4404',
} as const;

/**
 * Asset hues. Each asset type keeps a recognisable colour (dashboards green,
 * analyses purple, datasets blue...) but the tones sit with the rest of the
 * palette instead of the previous saturated set.
 */
export const assetHue = {
  dashboard: { main: '#1D8102', subtle: '#EAF7E6', strong: '#155E02' },
  analysis: { main: '#7A3FD3', subtle: '#F1EAFB', strong: '#5626A3' },
  dataset: { main: '#0972D3', subtle: '#E6F1FB', strong: '#033160' },
  datasource: { main: '#B8640E', subtle: '#FBF1E6', strong: '#7F4409' },
  folder: { main: '#5F6B7A', subtle: '#EEF0F2', strong: '#414D5C' },
  user: { main: '#C13A8A', subtle: '#FBEAF3', strong: '#8A2862' },
  group: { main: '#0E8A85', subtle: '#E6F5F4', strong: '#0A605D' },
  namespace: { main: '#8F3BB8', subtle: '#F4EAF9', strong: '#662A84' },
  public: { main: '#2A7DE1', subtle: '#E8F1FC', strong: '#1B5AA6' },
} as const;

export type AssetHueKey = keyof typeof assetHue;
