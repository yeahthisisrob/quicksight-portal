/**
 * Where this is heading. AWS Context (announced June 2026, not yet
 * available) is an identity-aware knowledge graph over an organisation's
 * data that agents query at runtime. When it can read QuickSight, the
 * reads this API serves (search, lineage, the cached metadata) become one
 * of many sources an agent has, and the portal's job narrows to the
 * QuickSight-specific parts: the parsed definitions and the validated
 * write paths. Saying so here, rather than pretending otherwise, is the
 * same honesty the SMUS integration has: point at the platform when it can
 * do the job.
 */
import { OpenInNew } from '@mui/icons-material';
import { Box, Button, Stack, Typography } from '@mui/material';

const AWS_CONTEXT_URL = 'https://aws.amazon.com/context/';

export function AwsContextNote() {
  return (
    <Box
      sx={(theme) => ({
        borderRadius: 2,
        p: 2.5,
        border: 1,
        borderColor: 'divider',
        background: `linear-gradient(135deg, ${theme.palette.action.hover}, transparent 70%)`,
      })}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
            What comes next
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25 }}>
            AWS Context
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 720 }}>
            AWS Context builds an identity-aware knowledge graph over the data an organisation
            already has and lets agents query it at runtime, with each call inheriting the caller's
            permissions. It was announced in June 2026 and is not yet available. Once it can read
            QuickSight, an agent will get search, lineage and metadata from there, and the portal
            will point it that way just as it points at SMUS today. What stays here is what a graph
            does not do: the parsed definitions, the checks, and the write paths that publish a
            change safely.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          href={AWS_CONTEXT_URL}
          target="_blank"
          rel="noreferrer"
          endIcon={<OpenInNew fontSize="small" />}
          sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', md: 'center' } }}
        >
          AWS Context
        </Button>
      </Stack>
    </Box>
  );
}
