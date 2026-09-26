import { Box, Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Container } from '../components/Container';
import { PageHeader } from '../components/PageHeader';
import { pal } from '../createAppTheme';
import { radius, typeScale } from '../tokens/scale';
import { darkColors, lightColors, type SemanticColors } from '../tokens/semantic';

const meta: Meta = {
  title: 'Design System/Overview',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The tokens and primitives together. Toggle the theme in the toolbar to see the dark scheme; every colour below is a CSS variable, so components never hold a hex.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({ name, value, dark }: { name: string; value: string; dark: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 260 }}>
      <Box
        sx={{
          display: 'flex',
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ width: 28, height: 28, backgroundColor: value }} title={`light ${value}`} />
        <Box sx={{ width: 28, height: 28, backgroundColor: dark }} title={`dark ${dark}`} />
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {value} / {dark}
        </Typography>
      </Box>
    </Box>
  );
}

function ColorGroup<K extends keyof SemanticColors>({ group }: { group: K }) {
  const light = lightColors[group] as Record<string, unknown>;
  const dark = darkColors[group] as Record<string, unknown>;
  const flat = (obj: Record<string, unknown>, prefix = ''): Array<[string, string]> =>
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'string'
        ? [[`${prefix}${k}`, v]]
        : flat(v as Record<string, unknown>, `${prefix}${k}.`)
    );
  const darkMap = new Map(flat(dark));
  return (
    <Container header={`palette.${group}`} headingLevel="h3">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 1.5,
        }}
      >
        {flat(light).map(([name, value]) => (
          <Swatch key={name} name={name} value={value} dark={darkMap.get(name) ?? value} />
        ))}
      </Box>
    </Container>
  );
}

export const Tokens: Story = {
  render: () => (
    <Stack spacing={2}>
      <PageHeader
        title="Design tokens"
        description="Colours by purpose, one set per scheme. In code: theme.vars.palette.<group>.<name>."
      />
      <ColorGroup group="brand" />
      <ColorGroup group="surface" />
      <ColorGroup group="text" />
      <ColorGroup group="border" />
      <ColorGroup group="status" />
      <ColorGroup group="asset" />
      <Container header="Type scale" headingLevel="h3">
        <Stack spacing={1}>
          {Object.entries(typeScale).map(([name, t]) => (
            <Box key={name} sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ width: 110, fontFamily: 'monospace' }}
              >
                {name}
              </Typography>
              <Typography sx={{ fontSize: t.size, lineHeight: t.lineHeight, fontWeight: t.weight }}>
                The quick brown fox - {t.size}px / {Math.round(t.size * t.lineHeight)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Container>
      <Container header="Radius" headingLevel="h3">
        <Stack direction="row" spacing={3}>
          {Object.entries(radius)
            .filter(([k]) => k !== 'full' && k !== 'none')
            .map(([name, r]) => (
              <Box key={name} sx={{ textAlign: 'center' }}>
                <Box
                  sx={(theme) => ({
                    width: 64,
                    height: 44,
                    borderRadius: `${r}px`,
                    border: `2px solid ${pal(theme).brand.primary}`,
                    backgroundColor: pal(theme).brand.subtle,
                  })}
                />
                <Typography variant="body2" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                  {name} {r}
                </Typography>
              </Box>
            ))}
        </Stack>
      </Container>
    </Stack>
  ),
};
