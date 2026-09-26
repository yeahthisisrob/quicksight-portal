/**
 * Everything repeatable the organisation standardises, in one place: the
 * filter bars every analysis starts from, the calculated fields worth
 * reusing, and the dashboards whose layout new assets follow. The builder
 * and the assistant apply them; changes here reach both.
 */
import { Box, Stack, Typography } from '@mui/material';

import { pal } from '@/shared/design-system';

import { CalculatedFieldTemplateList } from './CalculatedFieldTemplateList';
import { FilterBarTemplates } from './FilterBarTemplates';
import { LayoutStandards } from './LayoutStandards';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={(theme) => ({
        p: 2,
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: 'background.paper',
      })}
    >
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {description}
      </Typography>
      {children}
    </Box>
  );
}

export function TemplatesView() {
  return (
    <Stack spacing={2}>
      <Section
        title="Filter bars"
        description="The filters a sheet's control bar carries, in order and at their widths. The default one starts every analysis the portal builds."
      >
        <FilterBarTemplates />
      </Section>
      <Section
        title="Calculated fields"
        description="Expressions saved for reuse. The portal keeps these; SMUS has no home for them."
      >
        <CalculatedFieldTemplateList />
      </Section>
      <Section
        title="Layouts"
        description="Dashboards and analyses whose layout, text, controls and theme new assets can follow."
      >
        <LayoutStandards />
      </Section>
    </Stack>
  );
}
