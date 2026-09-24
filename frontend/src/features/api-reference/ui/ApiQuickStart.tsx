/**
 * Everything a person needs to point an agent at this portal with a key:
 * the two environment variables, the contract and the guide the agent
 * should read first, the loop it will run (read, build, publish), and a
 * prompt to paste. The key itself comes from the panel beside this.
 */
import { Box, Chip, Link, Stack, Typography } from '@mui/material';

import { Container } from '@/shared/design-system';

import { CodeBlock } from './CopyButton';

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Read what the portal knows',
    body: 'Search in plain words, then the cached export, catalog, columns and lineage. One call each, no QuickSight rate limits.',
  },
  {
    title: 'Build the change',
    body: 'Edit the definition yourself, or use the transforms: rebind, template, type rules, visuals by column names, or an ask the planner answers.',
  },
  {
    title: 'Publish it back',
    body: 'Preview first. Apply keeps the audience and theme, publishes the dashboard version, and records who did it.',
  },
];

function agentPrompt(origin: string): string {
  return [
    `You are working against a QuickSight Assets Portal at ${origin}.`,
    'QSP_API_URL and QSP_API_KEY are set in the environment. Send the key on every request as "Authorization: Bearer $QSP_API_KEY".',
    'Start by reading GET $QSP_API_URL/api/api-docs/guide (markdown) and GET $QSP_API_URL/api/api-docs/openapi (the contract).',
    'Read before you write: search, then the cached export, then the columns. Preview every write before applying it.',
    'Calls that return a jobId run in the background: poll GET /api/jobs/{jobId}, then read GET /api/jobs/{jobId}/result.',
  ].join('\n');
}

export function ApiQuickStart({ origin }: { origin: string }) {
  const env = `export QSP_API_URL="${origin}"\nexport QSP_API_KEY="qsp_…"   # from the panel below`;
  const first = [
    'curl -sS "$QSP_API_URL/api/api-docs/guide"   -H "Authorization: Bearer $QSP_API_KEY"',
    'curl -sS "$QSP_API_URL/api/api-docs/openapi" -H "Authorization: Bearer $QSP_API_KEY"',
  ].join('\n');
  return (
    <Container
      header="Use an agent with a key"
      description="Claude Code, a script, a CI job: anything that can make an HTTP request gets the same access as a signed-in user. Nothing here needs this repository."
    >
      <Stack spacing={2.5}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {STEPS.map((step, index) => (
            <Box
              key={step.title}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2, minWidth: 0 }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                <Chip size="small" label={index + 1} color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {step.title}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {step.body}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            1. Put the URL and a key where the caller will read them
          </Typography>
          <CodeBlock code={env} label="Copy the environment lines" />
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            2. The two calls to make first: the guide, then the contract
          </Typography>
          <CodeBlock code={first} label="Copy the first calls" />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            The guide says which calls to make in which order; the contract is the same document
            every endpoint is validated against, with{' '}
            <Box component="code" sx={{ fontFamily: 'monospace' }}>
              servers
            </Box>{' '}
            set to this portal. Both are also searchable below.
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            3. A prompt to paste into the agent
          </Typography>
          <CodeBlock code={agentPrompt(origin)} label="Copy the agent prompt" />
        </Box>

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Everything a key writes is recorded on the <Link href="/activity">timeline</Link> as the
          key's label and tagged on the asset, so "made by an agent" is a filter anywhere tags are.
        </Typography>
      </Stack>
    </Container>
  );
}
