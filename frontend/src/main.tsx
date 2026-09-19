import { CssBaseline, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SnackbarProvider } from 'notistack';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './app/App';
import { theme } from './app/theme';

// The single QueryClient lives in AppProviders (rendered inside App) — a
// second one here would shadow it and bind Devtools to a dead cache.

// StrictMode disabled - it was causing duplicate API calls in development
const AppWrapper = <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    {/* Light by default; the top bar's toggle switches schemes and MUI
        remembers the choice in localStorage. */}
    <ThemeProvider theme={theme} defaultMode="light">
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          autoHideDuration={3000}
        >
          <CssBaseline />
          {AppWrapper}
        </SnackbarProvider>
      </LocalizationProvider>
    </ThemeProvider>
  </BrowserRouter>
);
