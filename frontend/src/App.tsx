import { Box } from '@mui/material';
import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { AuthGuard, AuthenticatedApp } from './app/providers';
import { AppProviders } from './app/providers/AppProviders';
import {
  LoginPage,
  AuthCallbackPage,
  AssetsPage,
  DataCatalogPage,
  ExportPage,
  ArchivedAssetsPage,
  ScriptsPage,
  IngestionsPage,
} from './pages';
import { PageLoader, ErrorBoundary } from './shared/ui';
import { MainLayout } from './widgets';

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
                <Route index element={<Navigate to="/assets/dashboards" replace />} />
                
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
                  path="export" 
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <ExportPage />
                      </Suspense>
                    </ErrorBoundary>
                  } 
                />
                <Route 
                  path="archived-assets" 
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <ArchivedAssetsPage />
                      </Suspense>
                    </ErrorBoundary>
                  } 
                />
                <Route 
                  path="scripts" 
                  element={
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <ScriptsPage />
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