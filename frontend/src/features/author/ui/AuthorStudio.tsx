/**
 * AuthorStudio - the Author page: a steps rail beside one panel at a time.
 */
import { Box, Typography } from '@mui/material';

import { type AuthorFlow, type AuthorFlowOptions, useAuthorFlow } from '../model/useAuthorFlow';
import { HowItWorks } from './HowItWorks';
import { StepsRail } from './StepsRail';
import { MockupStep } from './steps/MockupStep';
import { NewDatasetsStep } from './steps/NewDatasetsStep';
import { NewPublishStep } from './steps/NewPublishStep';
import { PublishStep } from './steps/PublishStep';
import { RepairStep } from './steps/RepairStep';
import { ReviewStep } from './steps/ReviewStep';
import { SourceStep } from './steps/SourceStep';
import { StandardStep } from './steps/StandardStep';
import { TargetsStep } from './steps/TargetsStep';
import { VisualsStep } from './steps/VisualsStep';

const RAIL_WIDTH = 264;

function StepBody({ flow }: { flow: AuthorFlow }) {
  const fromNothing = flow.state.mode === 'new';
  switch (flow.state.step) {
    case 'source':
      return <SourceStep flow={flow} />;
    case 'repair':
      return <RepairStep flow={flow} />;
    case 'targets':
      return fromNothing ? <NewDatasetsStep flow={flow} /> : <TargetsStep flow={flow} />;
    case 'review':
      return <ReviewStep flow={flow} />;
    case 'visuals':
      return <VisualsStep flow={flow} />;
    case 'standard':
      return <StandardStep flow={flow} />;
    case 'mockup':
      return <MockupStep flow={flow} />;
    case 'publish':
      return fromNothing ? <NewPublishStep flow={flow} /> : <PublishStep flow={flow} />;
    default:
      return null;
  }
}

/** The page with its flow injected, so stories can drive it. */
export function AuthorStudioView({ flow }: { flow: AuthorFlow }) {
  // The mockup is a dashboard drawing with an inspector beside it: it needs
  // every pixel of width, so the rail moves above it as a horizontal stepper.
  const wide = flow.state.step === 'mockup';
  const fromNothing = flow.state.mode === 'new';
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Author
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {fromNothing
              ? 'Make a dashboard or analysis from nothing: pick datasets, describe it or name the columns, and see it before it exists.'
              : 'Make a dashboard or analysis like an existing one, on different datasets, shape it, and see it before it exists.'}
          </Typography>
        </Box>
        <HowItWorks defaultOpen={flow.state.source === null && !fromNothing} />
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: wide ? '1fr' : { xs: '1fr', md: `${RAIL_WIDTH}px minmax(0, 1fr)` },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box sx={wide ? undefined : { position: { md: 'sticky' }, top: { md: 24 } }}>
          <StepsRail
            status={flow.status}
            steps={flow.steps}
            onSelect={flow.goTo}
            orientation={wide ? 'horizontal' : undefined}
          />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <StepBody flow={flow} />
        </Box>
      </Box>
    </Box>
  );
}

export function AuthorStudio(options: AuthorFlowOptions = {}) {
  const flow = useAuthorFlow(options);
  return <AuthorStudioView flow={flow} />;
}
