import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

import { Sidebar, DRAWER_WIDTH } from './Sidebar';

export default function MainLayout() {
  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      <Box
        component="nav"
        sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}
      >
        <Sidebar />
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}