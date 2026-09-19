/**
 * AuthorStudio - the Author page: a steps rail beside one panel at a time.
 */
import { Box, Typography } from '@mui/material';

import { type AuthorFlow, type AuthorFlowOptions, useAuthorFlow } from '../model/useAuthorFlow';
import { StepsRail } from './StepsRail';
import { MockupStep } from './steps/MockupStep';
import { PublishStep } from './steps/PublishStep';
import { ReviewStep } from './steps/ReviewStep';
import { SourceStep } from './steps/SourceStep';
import { TargetsStep } from './steps/TargetsStep';

const RAIL_WIDTH = 264;

function StepBody({ flow }: { flow: AuthorFlow }) {
  switch (flow.state.step) {
    case 'source':
      return <SourceStep flow={flow} />;
    case 'targets':
      return <TargetsStep flow={flow} />;
    case 'review':
      return <ReviewStep flow={flow} />;
    case 'mockup':
      return <MockupStep flow={flow} />;
    case 'publish':
      return <PublishStep flow={flow} />;
    default:
      return null;
  }
}

/** The page with its flow injected, so stories can drive it. */
export function AuthorStudioView({ flow }: { flow: AuthorFlow }) {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Author
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Make a dashboard or analysis like an existing one, on different datasets, and see it
          before it exists.
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: `${RAIL_WIDTH}px minmax(0, 1fr)` },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box sx={{ position: { md: 'sticky' }, top: { md: 24 } }}>
          <StepsRail status={flow.status} onSelect={flow.goTo} />
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
