import { Box } from '@mui/material';
import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import {
  ActivityTimelinePage,
  AssetsPage,
  AssetTimelinePage,
  AuthCallbackPage,
  AuthorPage,
  DataCatalogPage,
  IngestionsPage,
  LoginPage,
  OperationsPage,
  SettingsPage,
} from '../pages';
import { ErrorBoundary, PageLoader } from '../shared/ui';
import { MainLayout } from '../widgets';
import { AuthenticatedApp, AuthGuard } from './providers';
import { AppProviders } from './providers/AppProviders';

// Lazy load all pages for code splitting

function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Auth routes - no layout */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/cognito/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/error" element={<LoginPage />} />

              {/* Protected routes - with layout */}
              <Route
                path="/"
                element={
                  <AuthGuard>
                    <AuthenticatedApp>
                      <MainLayout />
                    </AuthenticatedApp>
                  </AuthGuard>
                }
              >
                <Route index element={<Navigate to="/activity" replace />} />

                {/* Asset routes with type parameter */}
                <Route
                  path="assets/:type"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <AssetsPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                {/* Per-asset activity timeline drill-down */}
                <Route
                  path="assets/:type/:id/timeline"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <AssetTimelinePage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="data-catalog"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <DataCatalogPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="author"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <AuthorPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <SettingsPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="operations"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <OperationsPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                {/* Export, archived assets and scripts moved under Operations;
                    old links keep working. */}
                <Route path="export" element={<Navigate to="/operations" replace />} />
                <Route
                  path="archived-assets"
                  element={<Navigate to="/operations?tab=archived" replace />}
                />
                <Route path="scripts" element={<Navigate to="/operations?tab=scripts" replace />} />
                <Route
                  path="activity"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <ActivityTimelinePage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="ingestions"
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <IngestionsPage />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </Box>
      </ErrorBoundary>
    </AppProviders>
  );
}

export default App;
