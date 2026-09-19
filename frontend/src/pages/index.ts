/**
 * Lazy-loaded page components
 * All pages are code-split for optimal performance
 */
import { lazy } from 'react';

// Authentication pages (no layout)
export const LoginPage = lazy(() => import('./LoginPage').then((m) => ({ default: m.LoginPage })));
export const AuthCallbackPage = lazy(() =>
  import('./AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage }))
);

// Main application pages (with layout)
export const AssetsPage = lazy(() => import('./AssetsPage'));
export const AssetTimelinePage = lazy(() => import('./AssetTimelinePage'));
export const ActivityTimelinePage = lazy(() => import('./ActivityTimelinePage'));
export const DataCatalogPage = lazy(() => import('./DataCatalogPage'));
export const IngestionsPage = lazy(() => import('./IngestionsPage'));
export const AuthorPage = lazy(() => import('./AuthorPage'));
export const SettingsPage = lazy(() => import('./SettingsPage'));
export const OperationsPage = lazy(() => import('./OperationsPage'));
