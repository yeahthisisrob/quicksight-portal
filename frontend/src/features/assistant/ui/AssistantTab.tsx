/**
 * The Author page's Assistant tab: ask in plain words, and the assistant
 * reads the portal, plans, previews and prepares the change for you to run.
 * The models it thinks with are chosen here.
 */
import { Box, Stack, Typography } from '@mui/material';

import { AssistantChat } from './AssistantChat';
import { ModelPicker } from './ModelPicker';

export default function AssistantTab() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Assistant
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Ask for what you need. It finds the data, shows the plan and a preview, and prepares the
          change; nothing is written until you run it.
        </Typography>
      </Box>
      <Stack spacing={3}>
        <AssistantChat />
        <ModelPicker />
      </Stack>
    </Box>
  );
}
